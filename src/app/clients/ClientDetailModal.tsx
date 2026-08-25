"use client";
import { Modal, ModalContent, ModalTitle } from "indas-ui";
import ClientDetailBody from "./ClientDetailBody";

/**
 * Full client detail screen rendered as a large modal (Parkson `frontend-design`
 * skill pattern — ModalContent size="master" p-0 flex-col, fixed header + tabs,
 * scrollable body). 90vw × 90vh.
 */
export default function ClientDetailModal({
  id, isOpen, onClose, onChanged,
}: {
  id: string | null;
  isOpen: boolean;
  onClose: () => void;
  onChanged?: () => void;
}) {
  return (
    <Modal open={isOpen} onOpenChange={(o) => { if (!o) onClose(); }}>
      <ModalContent
        size="master"
        hideCloseButton
        disableOutsideClick
        className="p-0 flex flex-col overflow-hidden"
        aria-describedby={undefined}
      >
        <ModalTitle className="sr-only">Client Detail</ModalTitle>
        {isOpen && id && <ClientDetailBody id={id} onClose={onClose} onChanged={onChanged} inModal />}
      </ModalContent>
    </Modal>
  );
}
