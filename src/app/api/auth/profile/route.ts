import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import {
  getSessionUserFromRequest,
  createSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const sessionUser = await getSessionUserFromRequest(req);
    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'Pengguna tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      user,
    });
  } catch (err: any) {
    console.error('Error fetching user profile:', err);
    return NextResponse.json(
      { error: 'Gagal memuat profil pengguna' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const sessionUser = await getSessionUserFromRequest(req);
    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { firstName, lastName, email, currentPassword, newPassword } = body;

    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
    });

    if (!user) {
      return NextResponse.json({ error: 'Pengguna tidak ditemukan' }, { status: 404 });
    }

    const updateData: { name?: string; email?: string; passwordHash?: string } = {};

    // 1. Process Name (first name and last name)
    if (firstName !== undefined || lastName !== undefined) {
      const existingParts = (user.name || '').trim().split(' ');
      const existingFirst = existingParts[0] || '';
      const existingLast = existingParts.slice(1).join(' ') || '';

      const finalFirst = firstName !== undefined ? String(firstName).trim() : existingFirst;
      const finalLast = lastName !== undefined ? String(lastName).trim() : existingLast;
      const combined = `${finalFirst} ${finalLast}`.trim();

      if (!combined) {
        return NextResponse.json(
          { error: 'Nama pengguna tidak boleh kosong' },
          { status: 400 }
        );
      }
      updateData.name = combined;
    }

    // 2. Process Email
    if (email !== undefined) {
      const cleanEmail = String(email).trim().toLowerCase();
      if (!cleanEmail || !cleanEmail.includes('@')) {
        return NextResponse.json(
          { error: 'Format email tidak valid' },
          { status: 400 }
        );
      }

      if (cleanEmail !== user.email) {
        // Check if email already used by someone else
        const existing = await prisma.user.findFirst({
          where: {
            email: cleanEmail,
            NOT: { id: user.id },
          },
        });

        if (existing) {
          return NextResponse.json(
            { error: 'Email tersebut sudah digunakan oleh akun lain' },
            { status: 400 }
          );
        }
        updateData.email = cleanEmail;
      }
    }

    // 3. Process Password Update (Optional)
    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json(
          { error: 'Kata sandi saat ini wajib diisi untuk mengubah kata sandi' },
          { status: 400 }
        );
      }

      const isCurrentMatch = await bcrypt.compare(String(currentPassword), user.passwordHash);
      if (!isCurrentMatch) {
        return NextResponse.json(
          { error: 'Kata sandi saat ini tidak sesuai' },
          { status: 400 }
        );
      }

      if (String(newPassword).length < 6) {
        return NextResponse.json(
          { error: 'Kata sandi baru minimal 6 karakter' },
          { status: 400 }
        );
      }

      const newHash = await bcrypt.hash(String(newPassword), 10);
      updateData.passwordHash = newHash;
    }

    // 4. Update in Database
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...updateData,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
      },
    });

    // 5. Re-issue fresh session token so navbar & session cookie match immediately
    const newSessionToken = await createSessionToken({
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
    });

    const response = NextResponse.json({
      success: true,
      message: 'Profil berhasil diperbarui',
      user: updatedUser,
    });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: newSessionToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE_SECONDS,
    });

    return response;
  } catch (err: any) {
    console.error('Error updating user profile:', err);
    return NextResponse.json(
      { error: err.message || 'Gagal memperbarui profil pengguna' },
      { status: 500 }
    );
  }
}
