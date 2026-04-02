import { User } from '../models/User';

function hasLinkedRelationship(user: any, target: any) {
  if (!user || !target) return false;
  const linkedCaretakers = (target.linkedCaretakers || []).map((value: any) => value.toString());
  const linkedElders = (user.linkedElders || []).map((value: any) => value.toString());
  return (
    linkedCaretakers.includes(user._id?.toString()) ||
    linkedElders.includes(target._id?.toString())
  );
}

export async function resolveAccessibleUser(requesterUid: string, targetUid?: string) {
  const requester = await User.findOne({ uid: requesterUid });
  if (!requester) {
    return { error: { status: 404, message: 'Requesting user not found' } };
  }

  const resolvedTargetUid = targetUid || requesterUid;
  const targetUser = await User.findOne({ uid: resolvedTargetUid });
  if (!targetUser) {
    return { error: { status: 404, message: 'Target user not found' } };
  }

  const isSelf = requester.uid === targetUser.uid;
  const isLinkedCaretaker =
    requester.role === 'caretaker' &&
    targetUser.role === 'elder' &&
    hasLinkedRelationship(requester, targetUser);

  if (!isSelf && !isLinkedCaretaker) {
    return { error: { status: 403, message: 'Not authorized for this elder' } };
  }

  return { requester, targetUser };
}
