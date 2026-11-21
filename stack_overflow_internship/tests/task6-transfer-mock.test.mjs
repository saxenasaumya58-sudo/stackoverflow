import assert from "node:assert/strict";
import test from "node:test";
import {
  getTransferValidationError,
  getUpvoteMilestoneAward,
  REPUTATION_MILESTONES,
  REPUTATION_TRANSFER_POLICY,
} from "../lib/reputation-policy.mjs";

function mockTransfer({ sender, receiver, points, reason, now }) {
  const validationError = getTransferValidationError({
    senderReputation: sender.reputation,
    points,
  });
  if (validationError) throw new Error(validationError.message);

  const transaction = {
    sender: sender.id,
    receiver: receiver.id,
    points,
    reason,
    timestamp: now.toISOString(),
  };
  sender.reputation -= points;
  receiver.reputation += points;
  sender.transactions.push(transaction);
  receiver.transactions.push(transaction);
  sender.activity.push({
    points: -points,
    reason: `Transferred points to ${receiver.id}: ${reason}`,
    timestamp: transaction.timestamp,
  });
  receiver.activity.push({
    points,
    reason: `Received points from ${sender.id}: ${reason}`,
    timestamp: transaction.timestamp,
  });
  return transaction;
}

test("mock transfer moves 50 points and records both histories without a database", () => {
  const sender = {
    id: "mock-sender",
    reputation: 100,
    transactions: [],
    activity: [],
  };
  const receiver = {
    id: "mock-receiver",
    reputation: 100,
    transactions: [],
    activity: [],
  };
  const before = {
    sender: sender.reputation,
    receiver: receiver.reputation,
  };
  const now = new Date();
  const points = REPUTATION_TRANSFER_POLICY.maximumPointsPerTransaction;

  console.log("MOCK DATABASE: not connected");
  console.log(`BEFORE: sender=${before.sender}, receiver=${before.receiver}`);

  const transaction = mockTransfer({
    sender,
    receiver,
    points,
    reason: "Task 6 mock proof",
    now,
  });

  console.log(
    `AFTER: sender=${sender.reputation}, receiver=${receiver.reputation}`,
  );
  console.log(`HISTORY: ${JSON.stringify(transaction)}`);

  assert.deepEqual(
    { sender: sender.reputation, receiver: receiver.reputation },
    { sender: 50, receiver: 150 },
  );
  assert.equal(transaction.sender, sender.id);
  assert.equal(transaction.receiver, receiver.id);
  assert.equal(transaction.points, points);
  assert.equal(transaction.reason, "Task 6 mock proof");
  assert.equal(transaction.timestamp, now.toISOString());
  assert.equal(sender.transactions.length, 1);
  assert.equal(receiver.transactions.length, 1);
  assert.equal(sender.activity[0].points, -50);
  assert.equal(receiver.activity[0].points, 50);
});

test("five distinct mock voters award the answer milestone once", () => {
  const voters = new Set();
  let answerUpvotes = 0;
  let answerReputation = 0;
  let answerBonusAwarded = false;

  for (const voter of ["mock-voter-1", "mock-voter-2", "mock-voter-3", "mock-voter-4", "mock-voter-5"]) {
    const previousUpvotes = answerUpvotes;
    if (!voters.has(voter)) {
      voters.add(voter);
      answerUpvotes += 1;
    }
    const award = getUpvoteMilestoneAward({
      targetType: "answer",
      previousUpvotes,
      currentUpvotes: answerUpvotes,
      answerBonusAlreadyAwarded: answerBonusAwarded,
    });
    if (award) {
      answerReputation += award;
      answerBonusAwarded = true;
    }
  }

  assert.equal(voters.size, REPUTATION_MILESTONES.answerUpvotes);
  assert.equal(answerUpvotes, REPUTATION_MILESTONES.answerUpvotes);
  assert.equal(answerReputation, 5);
  assert.equal(
    getUpvoteMilestoneAward({
      targetType: "answer",
      previousUpvotes: answerUpvotes,
      currentUpvotes: answerUpvotes + 1,
      answerBonusAlreadyAwarded: answerBonusAwarded,
    }),
    0,
  );
  console.log(
    `MOCK VOTERS: ${voters.size}; answer points earned=${answerReputation}`,
  );
});

test("ten distinct mock voters award the question milestone once", () => {
  const voters = new Set();
  let questionUpvotes = 0;
  let questionReputation = 0;

  for (let index = 1; index <= REPUTATION_MILESTONES.questionUpvotes; index += 1) {
    const voter = `mock-question-voter-${index}`;
    const previousUpvotes = questionUpvotes;
    if (!voters.has(voter)) {
      voters.add(voter);
      questionUpvotes += 1;
    }
    questionReputation += getUpvoteMilestoneAward({
      targetType: "question",
      previousUpvotes,
      currentUpvotes: questionUpvotes,
    });
  }

  assert.equal(voters.size, REPUTATION_MILESTONES.questionUpvotes);
  assert.equal(questionUpvotes, REPUTATION_MILESTONES.questionUpvotes);
  assert.equal(questionReputation, 2);
  console.log(
    `MOCK QUESTION VOTERS: ${voters.size}; question points earned=${questionReputation}`,
  );
});
