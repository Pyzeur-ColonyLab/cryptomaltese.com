import React from 'react';
import styles from './Modal.module.css';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  showCloseButton?: boolean;
  fullScreen?: boolean;
}

const Modal: React.FC<ModalProps> = ({ open, onClose, children, showCloseButton = true, fullScreen = false }) => {
  if (!open) return null;
  
  const modalContentClass = fullScreen ? `${styles.modalContent} ${styles.fullScreen}` : styles.modalContent;
  
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={modalContentClass} onClick={e => e.stopPropagation()}>
        {showCloseButton && (
          <button className={styles.closeBtn} onClick={onClose}>Close</button>
        )}
        {children}
      </div>
    </div>
  );
};

export default Modal; 