import Axios from 'axios'
import { auth, currentUser } from '@clerk/nextjs/server'
import { prisma } from "@/app/database/prisma";
import dayjs from 'dayjs';
import { env } from "@/app/config/env";

const getGitHubAccessToken = async (code: string) => {
 const response = await Axios.post(
   "https://github.com/login/oauth/access_token",
   {
     client_id: env.GITHUB_APP_CLIENT_ID,
     client_secret: env.GITHUB_APP_CLIENT_SECRET,
     code,
     redirect_uri: 'http://localhost:3000/api/github/callback'
   },
   {
     headers: { Accept: "application/json" },
   }
 );
 return response.data;
};

export async function GET(request: Request) {
 await auth.protect()

 const user = await currentUser()

 if (!user) {
  return Response.json({message: 'No user found'})
 }

 const name = `${user.firstName || ''} ${user.lastName || ''}`.trim() || undefined;
 const email = user.emailAddresses?.[0]?.emailAddress;
 const avatarUrl = user.imageUrl;

 const url = new URL(request.url)

 const installationId = url.searchParams.get('installation_id') as string

 const accessToken = await getGitHubAccessToken(url.searchParams.get('code') as string)

 await prisma.customer.upsert({
  where: {
    clerkUserId: user.id
  },
  update: {
    githubAccessToken: accessToken.access_token,
    name: name,
    email: email,
    avatarUrl: avatarUrl,
    updatedAt: dayjs().toDate(),
    lastLoginAt: dayjs().toDate(),
    installations: {
      create: {
        githubInstallationId: parseInt(installationId)
      }
    }
  },
  create: {
    clerkUserId: user.id,
    githubAccessToken: accessToken.access_token,
    name: name,
    email: email,
    avatarUrl: avatarUrl,
    createdAt: dayjs().toDate(),
    updatedAt: dayjs().toDate(),
    lastLoginAt: dayjs().toDate(),
    installations: {
      create: {
        githubInstallationId: parseInt(installationId)
      }
    }
  }
 })

 return Response.json({message: 'Callback received.'})
}
