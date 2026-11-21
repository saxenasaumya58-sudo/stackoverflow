import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  getUpvoteMilestoneAward,
  getTransferValidationError,
  hasReputationPrivilege,
  REPUTATION_AWARDS,
  REPUTATION_MILESTONES,
  REPUTATION_PRIVILEGES,
  REPUTATION_TRANSFER_POLICY,
} from "../lib/reputation-policy.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("privileges unlock only at their configured reputation thresholds", () => {
  for (const threshold of Object.values(REPUTATION_PRIVILEGES)) {
    assert.equal(hasReputationPrivilege(threshold - 1, threshold), false);
    assert.equal(hasReputationPrivilege(threshold, threshold), true);
    assert.equal(hasReputationPrivilege(threshold + 1, threshold), true);
  }
  assert.equal(hasReputationPrivilege("not-a-number", 50), false);
});

test("transfer policy enforces sender eligibility and per-transaction bounds", () => {
  assert.equal(
    getTransferValidationError({ senderReputation: 50, points: 1 }).status,
    403,
  );
  assert.equal(
    getTransferValidationError({ senderReputation: undefined, points: 1 }).status,
    403,
  );
  assert.equal(
    getTransferValidationError({ senderReputation: 51, points: 0 }).status,
    400,
  );
  assert.equal(
    getTransferValidationError({ senderReputation: 51, points: 51 }).status,
    400,
  );
  assert.equal(
    getTransferValidationError({ senderReputation: 51, points: 50 }),
    null,
  );
});

test("transfer policy permits exactly 100 points and blocks crossing the daily cap", () => {
  assert.equal(
    getTransferValidationError({
      senderReputation: 100,
      points: 50,
      dailyTotal: 50,
    }),
    null,
  );
  assert.equal(
    getTransferValidationError({
      senderReputation: 200,
      points: 1,
      dailyTotal: 100,
    }).status,
    429,
  );
});

test("upvote rewards trigger at the distinct-voter milestones once", () => {
  assert.deepEqual(REPUTATION_MILESTONES, {
    answerUpvotes: 5,
    questionUpvotes: 10,
  });
  assert.equal(
    getUpvoteMilestoneAward({
      targetType: "answer",
      previousUpvotes: 3,
      currentUpvotes: 4,
    }),
    0,
  );
  assert.equal(
    getUpvoteMilestoneAward({
      targetType: "answer",
      previousUpvotes: REPUTATION_MILESTONES.answerUpvotes - 1,
      currentUpvotes: REPUTATION_MILESTONES.answerUpvotes,
    }),
    REPUTATION_AWARDS.answerFiveUpvotes,
  );
  assert.equal(
    getUpvoteMilestoneAward(
      {
        targetType: "answer",
        previousUpvotes: REPUTATION_MILESTONES.answerUpvotes - 1,
        currentUpvotes: REPUTATION_MILESTONES.answerUpvotes,
        answerBonusAlreadyAwarded: true,
      },
    ),
    0,
  );
  assert.equal(
    getUpvoteMilestoneAward({
      targetType: "question",
      previousUpvotes: REPUTATION_MILESTONES.questionUpvotes - 1,
      currentUpvotes: REPUTATION_MILESTONES.questionUpvotes,
    }),
    REPUTATION_AWARDS.questionTenUpvotes,
  );
  assert.equal(
    getUpvoteMilestoneAward({
      targetType: "question",
      previousUpvotes: REPUTATION_MILESTONES.questionUpvotes,
      currentUpvotes: REPUTATION_MILESTONES.questionUpvotes + 1,
    }),
    0,
  );
});

test("award values are wired into the reward and penalty routes", () => {
  assert.deepEqual(REPUTATION_AWARDS, {
    answerPosted: 5,
    answerAccepted: 10,
    answerFiveUpvotes: 5,
    questionTenUpvotes: 2,
    profileComplete: 10,
    downvoteReceived: -2,
    answerDeleted: -5,
    adminContentRemoved: -10,
  });
  const answersRoute = source("app/api/questions/[id]/answers/route.js");
  const acceptRoute = source("app/api/questions/[id]/accept/route.js");
  assert.match(answersRoute, /REPUTATION_AWARDS\.answerPosted/);
  assert.match(answersRoute, /REPUTATION_AWARDS\.answerDeleted/);
  assert.match(acceptRoute, /REPUTATION_AWARDS\.answerAccepted/);
  assert.ok(
    acceptRoute.indexOf("Answer.findOneAndUpdate") <
      acceptRoute.indexOf("Answer.updateMany"),
  );
  assert.match(source("lib/voting.js"), /getUpvoteMilestoneAward/);
  assert.match(source("app/api/profile/me/route.js"), /REPUTATION_AWARDS\.profileComplete/);
  assert.match(source("app/api/admin/reports/route.js"), /REPUTATION_AWARDS\.adminContentRemoved/);
  assert.match(source("lib/voting.js"), /REPUTATION_AWARDS\.downvoteReceived/);
});

test("reputation ledger retries cannot apply one event twice", () => {
  const reputationSource = source("lib/reputation.js");
  assert.match(reputationSource, /balanceApplied: false/);
  assert.match(
    reputationSource,
    /"reputationAwardEvents\.reference": \{ \$ne: reference \}/,
  );
  assert.match(reputationSource, /existingLog\.balanceApplied !== false/);
});

test("privilege routes enforce comment, edit, close, and report gates", () => {
  assert.match(source("lib/feed-interactions.js"), /REPUTATION_PRIVILEGES\.comment/);
  assert.match(source("app/api/feed/[id]/route.js"), /REPUTATION_PRIVILEGES\.editCommunityPost/);
  assert.match(source("app/api/questions/[id]/close-vote/route.js"), /REPUTATION_PRIVILEGES\.closeQuestion/);
  assert.match(source("app/api/posts/[id]/report/route.js"), /REPUTATION_PRIVILEGES\.reportInappropriateContent/);
});

test("standalone MongoDB transfer recovery runs without a session", () => {
  const transferSource = source("lib/reputation-transfer.js");
  assert.match(transferSource, /return operation\(null\)/);
  assert.doesNotMatch(transferSource, /if \(!session\) throw new Error\("Transaction not supported"\)/);
  assert.match(transferSource, /function sessionOptions\(session\)[\s\S]*return session \? \{ session \} : \{\}/);
});

test("transfer limits and rolling window share one non-expiring policy", () => {
  assert.deepEqual(REPUTATION_TRANSFER_POLICY, {
    minimumBalance: 50,
    minimumPointsPerTransaction: 1,
    maximumPointsPerTransaction: 50,
    maximumPointsPerRolling24Hours: 100,
    rollingWindowMs: 24 * 60 * 60 * 1000,
  });
  const transferSource = source("lib/reputation-transfer.js");
  assert.match(transferSource, /REPUTATION_TRANSFER_POLICY\.rollingWindowMs/);
  assert.doesNotMatch(transferSource, /localhost|new Date\(["'][0-9]{4}-/i);
  for (const locale of ["en", "es", "hi", "pt", "fr", "zh"]) {
    const messages = JSON.parse(
      source(`locales/${locale}/ui.json`),
    );
    assert.match(messages.transferGuidelines, /\{maximumPoints\}/);
    assert.match(messages.transferGuidelines, /\{dailyLimit\}/);
    assert.match(messages.profileBonusNotice, /\{points\}/);
  }
});
