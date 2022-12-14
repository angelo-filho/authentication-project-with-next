import Router from "next/router";
import { destroyCookie, parseCookies, setCookie } from "nookies";
import { createContext, ReactNode, useEffect, useState } from "react";
import { api } from "../services/apiClient";

type SignInCredentials = {
  email: string;
  password: string;
};

type User = {
  email: string;
  permissions: string[];
  roles: string[];
};

type AuthContextData = {
  signIn: (credentials: SignInCredentials) => Promise<void>;
  signOut: () => void;
  user: User | null;
  isAuthenticated: boolean;
};

type AuthProviderProps = {
  children: ReactNode;
};

export const AuthContext = createContext({} as AuthContextData);

let authChannel: BroadcastChannel;

export function signOut(sendMessage = true) {
  destroyCookie(undefined, "nextauth.token");
  destroyCookie(undefined, "nextauth.refreshToken");

  if (sendMessage) {
    authChannel.postMessage("signOut");
  }

  Router.push("/");
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const isAuthenticated = !!user;

  useEffect(() => {
    authChannel = new BroadcastChannel("auth");

    authChannel.onmessage = message => {
      switch (message.data) {
        case "signOut":
          signOut(false);
          break;
        default:
          break;
      }
    };
  }, []);

  useEffect(() => {
    const { "nextauth.token": token } = parseCookies();

    if (token) {
      api
        .get("/me")
        .then(response => {
          const { email, permissions, roles } = response.data;

          setUser({ email, permissions, roles });
        })
        .catch(() => signOut());
    }
  }, []);

  async function signIn({ email, password }: SignInCredentials) {
    try {
      const response = await api.post("sessions", {
        email,
        password,
      });

      const { token, refreshToken, permissions, roles } = response.data;

      setCookie(undefined, "nextauth.token", token, {
        maxAge: 60 * 60 * 24 * 30, // 30 dias
        path: "/",
      });

      setCookie(undefined, "nextauth.refreshToken", refreshToken, {
        maxAge: 60 * 60 * 24 * 30, // 30 dias
        path: "/",
      });

      setUser({ email, permissions, roles });

      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;

      Router.push("/dashboard");
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        signIn,
        signOut,
        user,
        isAuthenticated,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
