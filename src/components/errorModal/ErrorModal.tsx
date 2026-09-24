import Modal from "react-modal";
import cstyles from "../common/Common.module.css";
import { useContext, useEffect, useState } from "react";
import { ContextApp } from "../../context/ContextAppState";

type ErrorModalProps = {
  closeModal: () => void;
};

const ErrorModal: React.FC<ErrorModalProps> = ({ closeModal }) => {
  const context = useContext(ContextApp);
  const { errorModal } = context;
  const { title, body, modalIsOpen } = errorModal;
  // These existing callers use the error modal as a pending-operation dialog.
  // Closing it never cancelled native work, so it must not offer Cancel.
  const computing = title === "Computing Transaction";
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    setElapsed(0);
    if (!computing || !modalIsOpen) return;
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [computing, modalIsOpen]);

  return (
    <Modal
      isOpen={modalIsOpen}
      onRequestClose={computing ? undefined : closeModal}
      shouldCloseOnEsc={!computing}
      shouldCloseOnOverlayClick={!computing}
      className={cstyles.modal}
      overlayClassName={cstyles.modalOverlay}
    >
      <div className={cstyles.verticalflex}>
        <div className={cstyles.marginbottomlarge} style={{ textAlign: "center" }}>
          {title}
        </div>

        <div
          className={cstyles.well}
          style={{ textAlign: "center", wordBreak: "break-all", maxHeight: "400px", overflowY: "auto" }}
        >
          {computing ? (
            <div role="status" aria-live="polite">
              <p>Building and sending your transaction. Spending many mining rewards can take several minutes.</p>
              <p>Keep the wallet open. Wait for a result before submitting another payment.</p>
              <p aria-live="off">
                Elapsed: {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}
              </p>
            </div>
          ) : (
            body
          )}
        </div>
      </div>

      {!computing && (
        <div className={cstyles.buttoncontainer}>
          <button type="button" className={cstyles.primarybutton} onClick={closeModal}>
            Cancel
          </button>
        </div>
      )}
    </Modal>
  );
};

export default ErrorModal;
