import React, { useEffect, useState } from "react";
import Modal from "react-modal";
import cstyles from "../common/Common.module.css";
import { LOCK_CODE_MAX_LENGTH, LOCK_CODE_MIN_LENGTH, checkLockCode } from "../../utils/lockCode";

const { ipcRenderer } = window.electronAPI;

/**
 * Setting, changing and removing the code that locks this wallet.
 *
 * The code is compared in the main process, never here — this screen only
 * decides whether what was typed is worth sending. Two consequences are said
 * out loud on the form rather than discovered later: the code locks the
 * application and does not encrypt the wallet file, and it cannot be
 * recovered, so the recovery phrase stays the way back into a wallet whose
 * code is gone.
 */
type Props = {
  isOpen: boolean;
  onClose: () => void;
  /** Called with the new state whenever the code is set or removed. */
  onCodeChanged: (hasCode: boolean) => void;
};

const LockCodeModal: React.FC<Props> = ({ isOpen, onClose, onCodeChanged }) => {
  const [hasCode, setHasCode] = useState(false);
  const [currentCode, setCurrentCode] = useState("");
  const [newCode, setNewCode] = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setCurrentCode("");
    setNewCode("");
    setConfirmCode("");
    setError("");
    setNotice("");
    (async () => {
      const status: { hasCode?: boolean } = await ipcRenderer.invoke("lock:status");
      setHasCode(!!status?.hasCode);
    })();
  }, [isOpen]);

  const save = async () => {
    const shape = checkLockCode(newCode);
    if (!shape.ok) {
      setError(shape.reason);
      return;
    }
    if (shape.code !== confirmCode.trim()) {
      setError("The two codes are not the same.");
      return;
    }
    if (hasCode && currentCode.trim() === "") {
      setError("Enter your current code first.");
      return;
    }
    setBusy(true);
    setError("");
    const result: { ok?: boolean; reason?: string } = await ipcRenderer.invoke("lock:set", shape.code, currentCode.trim());
    setBusy(false);
    if (!result?.ok) {
      setError(result?.reason ?? "The code could not be saved.");
      return;
    }
    setHasCode(true);
    setCurrentCode("");
    setNewCode("");
    setConfirmCode("");
    setNotice("Your code is set. Lock the wallet to use it.");
    onCodeChanged(true);
  };

  const remove = async () => {
    if (currentCode.trim() === "") {
      setError("Enter your current code first.");
      return;
    }
    setBusy(true);
    setError("");
    const result: { ok?: boolean; reason?: string } = await ipcRenderer.invoke("lock:clear", currentCode.trim());
    setBusy(false);
    if (!result?.ok) {
      setError(result?.reason ?? "The code could not be removed.");
      return;
    }
    setHasCode(false);
    setCurrentCode("");
    setNotice("The code is removed. This wallet is no longer locked with one.");
    onCodeChanged(false);
  };


  const fieldStyle: React.CSSProperties = {
    marginTop: 8,
    padding: "8px 12px",
    width: "100%",
    letterSpacing: "0.3em",
    color: "var(--color-foreground)",
    background: "var(--color-background)",
    border: "1px solid var(--color-primary)",
    borderRadius: 4,
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      className={cstyles.centredsheet}
      overlayClassName={cstyles.modalOverlay}
      style={{ content: { maxWidth: 460 } }}
    >
      <div className={`${cstyles.xlarge} ${cstyles.center}`}>Wallet code</div>

      <div className={`${cstyles.well} ${cstyles.margintopsmall}`} style={{ marginTop: 24 }}>
        <div className={cstyles.small}>
          {hasCode
            ? "A code is set. It is asked for every time this wallet is locked."
            : "A code you type to open this wallet again after locking it."}
        </div>
        <div className={cstyles.small} style={{ opacity: 0.6, marginTop: 4 }}>
          {LOCK_CODE_MIN_LENGTH} to {LOCK_CODE_MAX_LENGTH} digits. It locks this application — it does not encrypt the
          wallet file, and it cannot be recovered, so keep your recovery phrase.
        </div>

        {hasCode && (
          <>
            <div className={cstyles.small} style={{ marginTop: 16 }}>
              Current code
            </div>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              aria-label="Current code"
              value={currentCode}
              onChange={(e) => setCurrentCode(e.target.value)}
              style={fieldStyle}
            />
          </>
        )}

        <div className={cstyles.small} style={{ marginTop: 16 }}>
          New code
        </div>
        <input
          type="password"
          inputMode="numeric"
          autoComplete="off"
          aria-label="New code"
          value={newCode}
          onChange={(e) => setNewCode(e.target.value)}
          style={fieldStyle}
        />

        <div className={cstyles.small} style={{ marginTop: 12 }}>
          New code again
        </div>
        <input
          type="password"
          inputMode="numeric"
          autoComplete="off"
          aria-label="New code again"
          value={confirmCode}
          onChange={(e) => setConfirmCode(e.target.value)}
          style={fieldStyle}
        />

        {error && <div className={`${cstyles.small} ${cstyles.red} ${cstyles.margintopsmall}`}>{error}</div>}
        {notice && (
          <div className={`${cstyles.small} ${cstyles.margintopsmall}`} style={{ color: "var(--swarm-green)" }}>
            {notice}
          </div>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 24 }}>
        <button type="button" className={cstyles.primarybutton} onClick={onClose}>
          Close
        </button>
        {hasCode && (
          <button type="button" className={cstyles.dangerbutton} onClick={remove} disabled={busy}>
            Remove code
          </button>
        )}
        <button type="button" className={cstyles.primarybutton} onClick={save} disabled={busy}>
          {busy ? "Saving…" : hasCode ? "Change code" : "Set code"}
        </button>
      </div>
    </Modal>
  );
};

export default LockCodeModal;
