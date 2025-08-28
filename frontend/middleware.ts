// import { NextResponse } from 'next/server';
// import { NextRequest } from 'next/server';
// import { getToken } from 'next-auth/jwt';

// // const isEnvAWS =
// //   process.env.NEXT_PUBLIC_NODE_ENV &&
// //   ['production', 'staging', 'development'].includes(process.env.NEXT_PUBLIC_NODE_ENV);

// export const config = {
//   matcher: [
//     '/((?!api).*)'
//   ]
// };

// const protectedPages = [
//   '/home'
// ];

// const protectedApis = [
//   '/api'
// ];

// async function digestMessage(message: string) {
//   const msgUint8 = new TextEncoder().encode(message); // encode as (utf-8) Uint8Array
//   const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8); // hash the message
//   const hashArray = Array.from(new Uint8Array(hashBuffer)); // convert buffer to byte array
//   const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join(''); // convert bytes to hex string
//   return hashHex;
// }

// async function verifyToken(req: NextRequest) {
//   const token = await getToken({ req });
//   const httpUrl = req.nextUrl.origin.replace('https', 'http');
//   if (!token?.email || !token?.accessToken) {
//     return false;
//   }

//   const hashedToken = await digestMessage(token.accessToken as string);

//   const requestBody = JSON.stringify({
//     keyType: token.provider === 'impersonation' ? 'impersonation' : 'user',
//     identifier: token.email,
//     itemType: 'token',
//     dataToVerify:
//       token.provider === 'impersonation'
//         ? await digestMessage(token.impersonateToken as string)
//         : hashedToken
//   });

//   try {
//     const fetchResponse = await fetch(`${httpUrl}/api/cache`, {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: requestBody
//     });

//     if (!fetchResponse.ok) {
//       console.error('Failed to fetch:', fetchResponse.statusText);
//       return false;
//     }

//     const responseJson = await fetchResponse.json();
//     return responseJson.verify;
//   } catch (error) {
//     console.error('Error during fetch operation:', error);
//     return false;
//   }
// }

// export const middleware = async (req: NextRequest) => {
//   const isProtectedPage = protectedPages.some((page) => req.nextUrl.pathname.includes(page));
//   const isProtectedApi = protectedApis.some((apiRoute) => req.nextUrl.pathname.includes(apiRoute));
//   if (isProtectedPage || isProtectedApi) {
//     const isTokenValid = await verifyToken(req);
//     if (!isTokenValid) {
//       if (isProtectedApi) {
//         return NextResponse.rewrite(new URL('/api/unauthorised', req.nextUrl.origin));
//       }
//       return NextResponse.redirect(new URL('/', req.nextUrl.origin));
//     }
//   }

//   return NextResponse.next();
// };
