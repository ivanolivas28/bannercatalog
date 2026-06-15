import GoogleProvider from "next-auth/providers/google";
import config from "@/config";
import connectMongo from "@/libs/mongoose";
import Customer from "@/models/Customer";

// MongoDB adapter is disabled until Atlas cluster is reachable.
// To re-enable: import MongoDBAdapter + EmailProvider, import connectMongo,
// and add them back below. Requires a valid MONGODB_URI in .env.local.

export const authOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_ID,
      clientSecret: process.env.GOOGLE_SECRET,
      async profile(profile) {
        return {
          id: profile.sub,
          name: profile.given_name ? profile.given_name : profile.name,
          email: profile.email,
          image: profile.picture,
          createdAt: new Date(),
        };
      },
    }),
  ],

  callbacks: {
    jwt: async ({ token, trigger }) => {
      // Re-check approval status on sign in or session update
      if (token?.email) {
        const adminEmails = (process.env.ADMIN_EMAILS || "")
          .split(",")
          .filter(Boolean);

        if (adminEmails.includes(token.email)) {
          token.isApproved = true;
          token.isAdmin = true;
        } else {
          try {
            await connectMongo();
            const customer = await Customer.findOne({
              email: token.email,
              status: "approved",
            }).lean();

            if (customer) {
              token.isApproved = true;
              token.customer = {
                id: customer._id.toString(),
                nombre: customer.nombre,
                empresa: customer.empresa,
              };
            } else {
              token.isApproved = false;
              token.customer = null;
            }
          } catch (e) {
            // If DB is unreachable, don't block auth — just mark as not approved
            console.error("[next-auth] Could not check customer status:", e.message);
            token.isApproved = false;
          }
        }
      }

      return token;
    },

    session: async ({ session, token }) => {
      if (session?.user) {
        session.user.id = token.sub;
        session.user.isApproved = token.isApproved ?? false;
        session.user.isAdmin = token.isAdmin ?? false;
        if (token.customer) {
          session.user.customer = token.customer;
        }
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
  theme: {
    brandColor: config.colors.main,
    logo: `https://${config.domainName}/logoAndName.png`,
  },
};
