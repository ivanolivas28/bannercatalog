import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import config from "@/config";
import connectMongo from "@/libs/mongoose";
import Customer from "@/models/Customer";

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

    // Email + password login (after customer sets password via magic link)
    CredentialsProvider({
      id: "customer-password",
      name: "Email y contraseña",
      credentials: {
        email: { label: "Correo", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        const { email, password } = credentials || {};
        if (!email || !password) return null;

        try {
          await connectMongo();

          const customer = await Customer.findOne({
            email: email.toLowerCase().trim(),
            status: "approved",
          }).select("+password");

          if (!customer || !customer.password) return null;

          const valid = await bcrypt.compare(password, customer.password);
          if (!valid) return null;

          return {
            id: customer._id.toString(),
            name: `${customer.nombre} ${customer.apellido}`,
            email: customer.email,
          };
        } catch (e) {
          console.error("[next-auth] customer-password authorize error:", e.message);
          return null;
        }
      },
    }),

    // Magic token — only used to verify identity and set password
    CredentialsProvider({
      id: "magic-token",
      name: "Magic Token",
      credentials: {
        token: { label: "Token", type: "text" },
      },
      async authorize(credentials) {
        const { token } = credentials || {};
        if (!token) return null;

        try {
          await connectMongo();

          const customer = await Customer.findOne({
            loginToken: token,
            loginTokenExpiry: { $gt: new Date() },
            status: "approved",
          });

          if (!customer) return null;

          return {
            id: customer._id.toString(),
            name: `${customer.nombre} ${customer.apellido}`,
            email: customer.email,
          };
        } catch (e) {
          console.error("[next-auth] magic-token authorize error:", e.message);
          return null;
        }
      },
    }),
  ],

  callbacks: {
    jwt: async ({ token, trigger }) => {
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
                moneda: customer.moneda || "USD",
              };
            } else {
              token.isApproved = false;
              token.customer = null;
            }
          } catch (e) {
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

  pages: {
    signIn: "/signin",
  },

  session: {
    strategy: "jwt",
  },

  theme: {
    brandColor: config.colors.main,
    logo: `https://${config.domainName}/logoAndName.png`,
  },
};
