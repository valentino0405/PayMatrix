import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectDB } from '@/lib/mongodb';
import Group from '@/lib/models/Group';

const MEMBER_COLORS = ['#6366f1','#ec4899','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ef4444','#06b6d4','#84cc16','#f97316'];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const icode = () => Math.random().toString(36).slice(2, 8).toUpperCase();

// GET /api/groups — all groups for logged-in user
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    await connectDB();
    const groups = await Group.find({ ownerClerkId: userId }).sort({ createdAt: -1 }).lean();
    return NextResponse.json(groups);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// POST /api/groups — create group
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { name, type, members } = await req.json();
    if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });
    const valid = (members ?? []).filter((m: any) => m.name.trim());
    if (valid.length < 2) return NextResponse.json({ error: 'Need at least 2 members' }, { status: 400 });

    await connectDB();
    const group = await Group.create({
      name: name.trim(), type: type ?? 'Other',
      members: valid.map((m: any, i: number) => ({ 
        id: uid(), 
        name: m.name.trim(), 
        email: m.email?.trim() || undefined,
        color: MEMBER_COLORS[i % MEMBER_COLORS.length] 
      })),
      inviteCode: icode(),
      ownerClerkId: userId,
    });
    return NextResponse.json(group, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
