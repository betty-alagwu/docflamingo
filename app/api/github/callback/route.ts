import Axios from 'axios'
import { auth } from '@clerk/nextjs/server'
import { prisma } from "@/app/database/prisma";

const getGitHubAccessToken = async (code: string) => {
 const response = await Axios.post(
   "https://github.com/login/oauth/access_token",
   {
     client_id: process.env.GITHUB_APP_CLIENT_ID,
     client_secret: process.env.GITHUB_APP_CLIENT_SECRET,
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

 const clerkUser = await auth()

 const url = new URL(request.url)

 const installationId = url.searchParams.get('installation_id') as string

 const accessToken = await getGitHubAccessToken(url.searchParams.get('code') as string)

 await prisma.customer.upsert({
  where: {
    clerkUserId: clerkUser.userId as string
  },
  update: {
    githubAccessToken: accessToken.access_token,
    installations: {
      create: {
        githubInstallationId: parseInt(installationId)
      }
    }
  },
  create: {
    clerkUserId: clerkUser.userId as string,
    githubAccessToken: accessToken.access_token,
    installations: {
      create: {
        githubInstallationId: parseInt(installationId)
      }
    }
  }
 })

 return Response.json({message: 'Callback received.'})
}
