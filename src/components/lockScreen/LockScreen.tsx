import React, { useEffect, useRef, useState } from "react";
import cstyles from "../common/Common.module.css";
import APP_VERSION from "../../version";
import { SWARM_APP_NAME } from "../../utils/swarmNetwork";
import { describeLockWait } from "../../utils/lockCode";
import { faLock } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

const { ipcRenderer } = window.electronAPI;

type Props = {
  onUnlock: () => void;
  /**
   * How this wallet is locked. "code" is a code the user set, typed here and
   * compared in the main process; "device" is the operating system prompt, the
   * only kind of lock this screen used to have.
   */
  mode?: "code" | "device";
  /** Signing out is offered even while locked: it is the way out of a code nobody remembers. */
  onSignOut?: () => void;
};

const LockScreen: React.FC<Props> = ({ onUnlock, mode = "device", onSignOut }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const [waitSeconds, setWaitSeconds] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // A wait that is counting down has to be visible while it counts, or the
  // button looks broken for a minute and the user reloads the app to get
  // around it — which is exactly what the wait is trying to prevent.
  useEffect(() => {
    if (waitSeconds <= 0) return undefined;
    const timer = setInterval(() => setWaitSeconds((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, [waitSeconds]);

  useEffect(() => {
    if (mode === "code") inputRef.current?.focus();
  }, [mode]);

  const handleUnlock = async () => {
    setLoading(true);
    setError("");
    try {
      // This reason is what Windows Hello puts in front of the user, so it
      // has to name the application they are actually unlocking.
      const result: { success: boolean } = await ipcRenderer.invoke("auth:verify", `Unlock ${SWARM_APP_NAME}`);
      if (result.success) {
        onUnlock();
      } else {
        setError("Authentication was not completed. Please try again.");
      }
    } catch {
      setError("Authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleUnlockWithCode = async () => {
    if (loading || waitSeconds > 0) return;
    const trimmed = code.trim();
    if (trimmed === "") {
      setError("Enter your code.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result: { ok: boolean; waitSeconds?: number; reason?: string } = await ipcRenderer.invoke(
        "lock:verify",
        trimmed,
      );
      if (result.ok) {
        // No second chance on success: the code goes out of this component's
        // state and out of the input the moment it is accepted.
        setCode("");
        onUnlock();
      } else {
        setError(result.reason ?? "That code is not right.");
        setWaitSeconds(result.waitSeconds ?? 0);
        setCode("");
        inputRef.current?.focus();
      }
    } catch {
      setError("The code could not be checked. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--color-background)",
        zIndex: 9999,
      }}
    >
      <FontAwesomeIcon icon={faLock} style={{ fontSize: 48, marginBottom: 24, opacity: 0.7 }} />
      <div className={`${cstyles.large} ${cstyles.center} ${cstyles.margintopsmall}`}>{SWARM_APP_NAME} is locked</div>
      <div className={`${cstyles.sublight} ${cstyles.center}`} style={{ opacity: 0.5, marginTop: 4 }}>
        v{APP_VERSION}
      </div>
      {mode === "code" ? (
        <>
          <div
            className={`${cstyles.small} ${cstyles.center} ${cstyles.margintopsmall}`}
            style={{ opacity: 0.6, maxWidth: 320 }}
          >
            Enter your code to use this wallet.
          </div>
          <input
            ref={inputRef}
            type="password"
            inputMode="numeric"
            autoComplete="off"
            aria-label="Lock code"
            value={code}
            disabled={loading || waitSeconds > 0}
            onChange={(e) => {
              setCode(e.target.value);
              if (error) setError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleUnlockWithCode();
            }}
            style={{
              marginTop: 24,
              padding: "10px 14px",
              minWidth: 200,
              textAlign: "center",
              letterSpacing: "0.35em",
              fontSize: 18,
              color: "var(--color-foreground)",
              background: "var(--color-background)",
              border: "1px solid var(--color-primary)",
              borderRadius: 4,
            }}
          />
        </>
      ) : (
        <div
          className={`${cstyles.small} ${cstyles.center} ${cstyles.margintopsmall}`}
          style={{ opacity: 0.6, maxWidth: 320 }}
        >
          Device authentication is required to access this wallet.
        </div>
      )}
      {error && <div className={`${cstyles.small} ${cstyles.red} ${cstyles.margintopsmall}`}>{error}</div>}
      {waitSeconds > 0 && (
        <div className={`${cstyles.small} ${cstyles.center} ${cstyles.margintopsmall}`} style={{ opacity: 0.6 }}>
          {describeLockWait(waitSeconds)}
        </div>
      )}
      <button
        type="button"
        className={cstyles.primarybutton}
        style={{ marginTop: 32, minWidth: 140 }}
        onClick={mode === "code" ? handleUnlockWithCode : handleUnlock}
        disabled={loading || waitSeconds > 0}
      >
        {loading ? (mode === "code" ? "Checking..." : "Authenticating...") : "Unlock"}
      </button>
      {/*
        Two things this screen says plainly rather than leaving the user to
        guess: the code locks this window and not the wallet file, and signing
        out is always available — it is the only way out when the code is
        forgotten, and it is the same thing the Sign out button does anywhere
        else in the application.
      */}
      {mode === "code" && (
        <div
          className={`${cstyles.small} ${cstyles.center}`}
          style={{ opacity: 0.5, maxWidth: 340, marginTop: 20 }}
        >
          The code locks this application. It does not encrypt the wallet file. Forgotten it? Sign out, then restore
          the wallet from your recovery phrase in a new installation — a code cannot be recovered.
        </div>
      )}
      {onSignOut && (
        <button
          type="button"
          className={cstyles.secondarybutton}
          style={{ marginTop: 16, minWidth: 140 }}
          onClick={onSignOut}
        >
          Sign out
        </button>
      )}
    </div>
  );
};

export default LockScreen;
