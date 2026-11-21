import "server-only";
import mongoose from "mongoose";
import { Invoice, Subscription, User } from "@/lib/models";
import { plans } from "@/lib/plans";
import { sendEmail } from "@/lib/services";
import { createInvoicePdf } from "@/lib/invoice-pdf";

async function deliverInvoiceEmail(invoice, user) {
  if (invoice.emailSent) return invoice;

  const pdf = await createInvoicePdf(invoice, user);
  try {
    await sendEmail({
      to: user.email,
      subject: `Commons ${invoice.planName} receipt ${invoice.invoiceNumber}`,
      text: `Thank you for subscribing to Commons ${invoice.planName}. Amount paid: INR ${invoice.amount}. Invoice: ${invoice.invoiceNumber}. Renewal date: ${invoice.renewalDate ? new Date(invoice.renewalDate).toLocaleDateString() : "not available"}.`,
      attachments: [
        { filename: `${invoice.invoiceNumber}.pdf`, content: pdf },
      ],
    });
  } catch (emailErr) {
    invoice.emailError = emailErr.message || "Invoice email delivery failed.";
    await invoice.save();
    const error = new Error(`INVOICE_EMAIL_FAILED: ${invoice.emailError}`);
    error.status = 500;
    error.code = "INVOICE_EMAIL_FAILED";
    throw error;
  }

  invoice.emailSent = true;
  invoice.emailSentAt = new Date();
  invoice.emailError = undefined;
  await invoice.save();
  return invoice;
}

export async function resendInvoiceEmail(invoiceId, userId) {
  const invoice = await Invoice.findOne({
    _id: invoiceId,
    $or: [{ userId }, { user: userId }],
  });
  if (!invoice)
    throw Object.assign(new Error("Invoice not found."), { status: 404 });

  const user = await User.findById(invoice.userId || invoice.user);
  if (!user)
    throw Object.assign(new Error("Invoice owner was not found."), {
      status: 404,
    });

  await deliverInvoiceEmail(invoice, user);
  return invoice;
}

export async function activatePaidSubscription(payment) {
  let invoice;
  let user;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      invoice = await Invoice.findOne({
        $or: [
          { paymentId: payment.id },
          { razorpayOrderId: payment.order_id },
        ],
      }).session(session);
      if (invoice) {
        if (invoice.paymentId !== payment.id)
          throw Object.assign(
            new Error("This order is already associated with another payment."),
            { status: 409 },
          );
        user = await User.findById(invoice.userId || invoice.user).session(session);
        return;
      }

      const subscription = await Subscription.findOne({
        razorpayOrderId: payment.order_id,
      }).session(session);
      if (!subscription)
        throw Object.assign(new Error("No subscription matches this payment."), {
          status: 404,
        });

      const planCode = String(subscription.plan);
      const plan = plans.find((item) => item.slug === planCode);
      if (!plan || plan.price < 1 || payment.amount !== plan.price * 100)
        throw Object.assign(new Error("Payment amount does not match the plan."), {
          status: 402,
        });

      user = await User.findById(subscription.userId || subscription.user).session(session);
      if (!user)
        throw Object.assign(new Error("Subscription owner was not found."), {
          status: 404,
        });

      const now = new Date();
      const renewalDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      await Subscription.updateMany(
        {
          $or: [{ userId: user._id }, { user: user._id }],
          _id: { $ne: subscription._id },
          status: "active",
        },
        { $set: { status: "expired", active: false } },
        { session },
      );
      const active = await Subscription.findOneAndUpdate(
        {
          _id: subscription._id,
          $or: [
            { status: "pending" },
            { status: "active", razorpayPaymentId: payment.id },
          ],
        },
        {
          $set: {
            status: "active",
            active: true,
            startDate: subscription.startDate || now,
            startedAt: subscription.startedAt || now,
            renewalDate,
            razorpayPaymentId: payment.id,
            billingDetails: {
              name: user.name,
              email: user.email,
              address: subscription.billingDetails?.address || user.location || "",
            },
          },
        },
        { new: true, session },
      );
      if (!active)
        throw Object.assign(new Error("This subscription was already processed."), {
          status: 409,
        });

      [invoice] = await Invoice.create(
        [
          {
            userId: user._id,
            user: user._id,
            subscriptionId: active._id,
            subscription: active._id,
            plan: plan.slug,
            planName: plan.name,
            amount: plan.price,
            date: now,
            paidAt: now,
            renewalDate,
            paymentId: payment.id,
            razorpayOrderId: payment.order_id,
            razorpayPaymentId: payment.id,
          },
        ],
        { session },
      );
      active.invoiceNumber = invoice.invoiceNumber;
      await active.save({ session });
    });
  } finally {
    await session.endSession();
  }

  if (!invoice || !user) throw new Error("Payment activation did not complete.");
  const downloadUrl = `/api/invoices/${invoice._id}`;
  if (invoice.pdfUrl !== downloadUrl) {
    invoice.pdfUrl = downloadUrl;
    await invoice.save();
  }
  await deliverInvoiceEmail(invoice, user);
  console.info("[billing] Subscription payment processed", {
    invoiceNumber: invoice.invoiceNumber,
    plan: invoice.plan,
  });
  return invoice;
}