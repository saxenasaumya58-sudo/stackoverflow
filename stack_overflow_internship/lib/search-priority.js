export function authorSubscriptionPriorityStages(now = new Date()) {
  return [
    {
      $lookup: {
        from: "subscriptions",
        let: { authorId: "$author" },
        pipeline: [
          {
            $match: {
              status: "active",
              $expr: {
                $and: [
                  {
                    $or: [
                      { $eq: ["$user", "$$authorId"] },
                      { $eq: ["$userId", "$$authorId"] },
                    ],
                  },
                  {
                    $or: [
                      { $eq: ["$plan", "free"] },
                      { $gt: ["$renewalDate", now] },
                    ],
                  },
                ],
              },
            },
          },
          { $sort: { createdAt: -1 } },
          { $limit: 1 },
          { $project: { plan: 1 } },
        ],
        as: "authorSubscription",
      },
    },
    {
      $addFields: {
        authorPlanPriority: {
          $switch: {
            branches: [
              { case: { $eq: [{ $arrayElemAt: ["$authorSubscription.plan", 0] }, "gold"] }, then: 3 },
              { case: { $eq: [{ $arrayElemAt: ["$authorSubscription.plan", 0] }, "silver"] }, then: 2 },
              { case: { $eq: [{ $arrayElemAt: ["$authorSubscription.plan", 0] }, "bronze"] }, then: 1 },
            ],
            default: 0,
          },
        },
      },
    },
    { $sort: { authorPlanPriority: -1, createdAt: -1 } },
  ];
}