export function canApproveWithdrawal(input: {
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REQUESTED' | 'FAILED';
  cooldownEndsAt: Date;
}) {
  if (!['PENDING_APPROVAL', 'APPROVED'].includes(input.status)) return false;
  return input.cooldownEndsAt.getTime() <= Date.now();
}
