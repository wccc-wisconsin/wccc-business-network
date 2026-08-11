import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware();

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jinja2|txt|xml|json|map|csv|ico|png|jpg|jpeg|gif|svg|webp|woff|woff2|ttf|otf|eot|mp4|mp3|wav|ogg|flv|wmv|swf|flac|aac|m4a|m4v|webm)).*)",
    "/(api|trpc)(.*)",
  ],
};
