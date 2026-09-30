"use client";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowRight, Eye, EyeOff, Mail, LockKeyhole } from "lucide-react";
import { login } from "@/app/login/actions";
function Submit() {
  const { pending } = useFormStatus();
  return (
    <button className="primary login-submit" disabled={pending}>
      {pending ? "Signing in..." : "Enter the vault"}
      <ArrowRight size={18} />
    </button>
  );
}
export default function LoginForm({ error }: { error?: string }) {
  const [show, setShow] = useState(false);
  return (
    <form action={login} className="login-fields">
      <label>
        Email
        <div className="input-icon">
          <Mail size={18} />
          <input
            name="email"
            aria-label="Email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
          />
        </div>
      </label>
      <label>
        Password
        <div className="input-icon">
          <LockKeyhole size={18} />
          <input
            name="password"
            aria-label="Password"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Your password"
            required
            minLength={6}
          />
          <button
            type="button"
            className="icon-button"
            title={show ? "Hide password" : "Show password"}
            aria-label={show ? "Hide password" : "Show password"}
            onClick={() => setShow(!show)}
          >
            {show ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
      </label>
      {error && (
        <p className="error" role="alert">
          {error === "access"
            ? "This account does not have workspace access."
            : "Incorrect email or password."}
        </p>
      )}
      <Submit />
    </form>
  );
}
