import { useState, type FormEvent } from "react";
import { BrandLogo } from "../components/BrandLogo";

type AuthActionResult = {
  error: string | null;
  needsEmailConfirmation?: boolean;
};

type AuthScreenProps = {
  signIn: (email: string, password: string) => Promise<AuthActionResult>;
  signUp: (displayName: string, email: string, password: string) => Promise<AuthActionResult>;
};

export function AuthScreen({ signIn, signUp }: AuthScreenProps) {
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);

    try {
      const result = mode === "signup"
        ? await signUp(displayName, email, password)
        : await signIn(email, password);
      if (result.error) setError(result.error);
      else if (result.needsEmailConfirmation) {
        setMessage("Check your inbox for a confirmation link, then sign in here.");
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Authentication failed. Try again.");
    } finally {
      setPending(false);
    }
  }

  function changeMode(nextMode: "login" | "signup") {
    setMode(nextMode);
    setError(null);
    setMessage(null);
  }

  return (
    <main className="auth-layout">
      <section className="auth-story" aria-label="Fitspo introduction">
        <BrandLogo className="brand-logo-auth" />
        <div className="story-copy">
          <p className="eyebrow">A better feel for your style</p>
          <h1>Find the pieces<br />that feel like <em>you.</em></h1>
          <p className="story-note">Start with the looks you love. Build a style profile that travels with you.</p>
        </div>
        <div className="story-index"><span>01</span><span className="index-rule" /><span>YOUR STYLE, IN FOCUS</span></div>
      </section>

      <section className="auth-panel">
        <div className="auth-box">
          <div className="auth-heading">
            <p className="eyebrow">{mode === "signup" ? "A few things first" : "Welcome back"}</p>
            <h2>{mode === "signup" ? "Create your account" : "Sign in to Fitspo"}</h2>
          </div>

          <div className="auth-tabs" role="tablist" aria-label="Authentication">
            <button type="button" role="tab" aria-selected={mode === "signup"} onClick={() => changeMode("signup")}>Create account</button>
            <button type="button" role="tab" aria-selected={mode === "login"} onClick={() => changeMode("login")}>Sign in</button>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {mode === "signup" && (
              <label>
                Name <span className="optional">Optional</span>
                <input autoComplete="name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
              </label>
            )}
            <label>
              Email
              <input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <label>
              Password
              <input type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={6} required value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
            {error && <p className="form-feedback form-error" role="alert">{error}</p>}
            {message && <p className="form-feedback form-success" role="status">{message}</p>}
            <button className="primary-button" type="submit" disabled={pending}>
              {pending ? "Please wait..." : mode === "signup" ? "Create account" : "Sign in"}
              {!pending && <span aria-hidden="true">↗</span>}
            </button>
          </form>
          <p className="auth-legal">By continuing, you agree to create a Fitspo account for your personal style profile.</p>
        </div>
      </section>
    </main>
  );
}