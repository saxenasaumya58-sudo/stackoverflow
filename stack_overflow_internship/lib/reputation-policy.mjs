export const REPUTATION_PRIVILEGES = Object.freeze({
  comment: 50,
  editCommunityPost: 100,
  closeQuestion: 250,
  reportInappropriateContent: 500,
});

export const REPUTATION_AWARDS = Object.freeze({
  answerPosted: 5,
  answerAccepted: 10,
  answerFiveUpvotes: 5,
  questionTenUpvotes: 2,
  profileComplete: 10,
  downvoteReceived: -2,
  answerDeleted: -5,
  adminContentRemoved: -10,
});

export const REPUTATION_MILESTONES = Object.freeze({
  answerUpvotes: 5,
  questionUpvotes: 10,
});

export const REPUTATION_TRANSFER_POLICY = Object.freeze({
  minimumBalance: 50,
  minimumPointsPerTransaction: 1,
  maximumPointsPerTransaction: 50,
  maximumPointsPerRolling24Hours: 100,
  rollingWindowMs: 24 * 60 * 60 * 1000,
});

export const REPUTATION_TRANSFER_MINIMUM_BALANCE =
  REPUTATION_TRANSFER_POLICY.minimumBalance;

export function getUpvoteMilestoneAward({
  targetType,
  previousUpvotes,
  currentUpvotes,
  answerBonusAlreadyAwarded = false,
}) {
  const previous = Number(previousUpvotes);
  const current = Number(currentUpvotes);
  if (!Number.isFinite(previous) || !Number.isFinite(current)) return 0;
  if (
    targetType === "answer" &&
    !answerBonusAlreadyAwarded &&
    previous < REPUTATION_MILESTONES.answerUpvotes &&
    current >= REPUTATION_MILESTONES.answerUpvotes
  )
    return REPUTATION_AWARDS.answerFiveUpvotes;
  if (
    targetType === "question" &&
    previous < REPUTATION_MILESTONES.questionUpvotes &&
    current >= REPUTATION_MILESTONES.questionUpvotes
  )
    return REPUTATION_AWARDS.questionTenUpvotes;
  return 0;
}

export function hasReputationPrivilege(points, threshold) {
  const reputation = Number(points);
  return Number.isFinite(reputation) && reputation >= threshold;
}

export function getTransferValidationError({
  senderReputation,
  points,
  dailyTotal = 0,
}) {
  if (
    !Number.isInteger(points) ||
    points < REPUTATION_TRANSFER_POLICY.minimumPointsPerTransaction ||
    points > REPUTATION_TRANSFER_POLICY.maximumPointsPerTransaction
  )
    return {
      status: 400,
      message: `A transfer must be between ${REPUTATION_TRANSFER_POLICY.minimumPointsPerTransaction} and ${REPUTATION_TRANSFER_POLICY.maximumPointsPerTransaction} points.`,
    };
  const reputation = Number(senderReputation);
  if (
    !Number.isFinite(reputation) ||
    reputation <= REPUTATION_TRANSFER_POLICY.minimumBalance
  )
    return {
      status: 403,
      message: `You need more than ${REPUTATION_TRANSFER_POLICY.minimumBalance} reputation points to transfer.`,
    };
  const transferredToday = Number(dailyTotal);
  if (
    !Number.isFinite(transferredToday) ||
    transferredToday < 0 ||
    transferredToday + points >
      REPUTATION_TRANSFER_POLICY.maximumPointsPerRolling24Hours
  )
    return {
      status: 429,
      message: `You can transfer at most ${REPUTATION_TRANSFER_POLICY.maximumPointsPerRolling24Hours} reputation points per rolling 24 hours.`,
    };
  return null;
}
