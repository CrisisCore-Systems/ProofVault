// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  useAppLockMock,
  previewEncryptedBackupMock,
  importEncryptedBackupMock,
  listRollbackSnapshotsMock,
  restoreRollbackSnapshotMock,
  exportEncryptedBackupMock,
} = vi.hoisted(() => ({
  useAppLockMock: vi.fn(),
  previewEncryptedBackupMock: vi.fn(),
  importEncryptedBackupMock: vi.fn(),
  listRollbackSnapshotsMock: vi.fn(),
  restoreRollbackSnapshotMock: vi.fn(),
  exportEncryptedBackupMock: vi.fn(),
}));

vi.mock("../../features/security/AppLock", () => ({
  useAppLock: useAppLockMock,
}));

vi.mock("../../features/security/backup", () => ({
  exportEncryptedBackup: exportEncryptedBackupMock,
  previewEncryptedBackup: previewEncryptedBackupMock,
  importEncryptedBackup: importEncryptedBackupMock,
  listRollbackSnapshots: listRollbackSnapshotsMock,
  restoreRollbackSnapshot: restoreRollbackSnapshotMock,
}));

import { Security } from "./Security";

const reactActEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

async function renderSecurity() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(<Security />);
    await Promise.resolve();
  });

  return {
    container,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

function getSectionByHeading(container: HTMLElement, heading: string): HTMLElement {
  const title = Array.from(container.querySelectorAll("h3, h4")).find((candidate) => candidate.textContent?.trim() === heading);

  if (!(title instanceof HTMLElement)) {
    throw new Error(`Unable to find section heading: ${heading}`);
  }

  const section = title.closest("form, section");

  if (!(section instanceof HTMLElement)) {
    throw new Error(`Unable to resolve section for heading: ${heading}`);
  }

  return section;
}

function getLabelControl(scope: HTMLElement, labelText: string): HTMLInputElement | HTMLSelectElement {
  const label = Array.from(scope.querySelectorAll("label")).find((candidate) =>
    candidate.textContent?.includes(labelText)
  );

  if (!label) {
    throw new Error(`Unable to find label: ${labelText}`);
  }

  const control = label.querySelector("input, select");

  if (!(control instanceof HTMLInputElement || control instanceof HTMLSelectElement)) {
    throw new Error(`Unable to find control for label: ${labelText}`);
  }

  return control;
}

function getButton(scope: HTMLElement, label: string): HTMLButtonElement {
  const button = Array.from(scope.querySelectorAll("button")).find((candidate) => candidate.textContent?.trim() === label);

  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Unable to find button: ${label}`);
  }

  return button;
}

function setTextInputValue(input: HTMLInputElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");

  const setNativeValue = descriptor?.set;

  if (!setNativeValue) {
    throw new Error("Unable to resolve the native input value setter.");
  }

  act(() => {
    setNativeValue.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function setFileInputValue(input: HTMLInputElement, file: File) {
  act(() => {
    Object.defineProperty(input, "files", {
      configurable: true,
      value: [file],
    });
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

async function clickButton(button: HTMLButtonElement) {
  await act(async () => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await Promise.resolve();
  });
}

async function submitForm(form: HTMLElement) {
  if (!(form instanceof HTMLFormElement)) {
    throw new Error("Expected a form element for submission.");
  }

  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await Promise.resolve();
  });
}

async function waitFor(assertion: () => void, attempts = 20) {
  for (let index = 0; index < attempts; index += 1) {
    try {
      assertion();
      return;
    } catch (error) {
      if (index === attempts - 1) {
        throw error;
      }

      await act(async () => {
        await Promise.resolve();
      });
    }
  }
}

function createBackupFile() {
  return new File([JSON.stringify({ ok: true })], "proofvault-backup-test.pvault", {
    type: "application/json",
  });
}

async function seedRestoreForm(scope: HTMLElement, file: File, passphrase: string) {
  setFileInputValue(getLabelControl(scope, "Backup file") as HTMLInputElement, file);
  setTextInputValue(getLabelControl(scope, "Backup passphrase") as HTMLInputElement, passphrase);
}

describe("Security route", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    useAppLockMock.mockReset();
    previewEncryptedBackupMock.mockReset();
    importEncryptedBackupMock.mockReset();
    listRollbackSnapshotsMock.mockReset();
    restoreRollbackSnapshotMock.mockReset();
    exportEncryptedBackupMock.mockReset();

    useAppLockMock.mockReturnValue({
      idleTimeoutMinutes: 10,
      lock: vi.fn(),
      lockOnHidden: true,
      rotatePassphrase: vi.fn(async () => undefined),
      setIdleTimeoutMinutes: vi.fn(),
      setLockOnHidden: vi.fn(),
    });
  });

  afterEach(() => {
    document.body.innerHTML = "";
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("previews, stages, and confirms a backup restore from the Security screen", async () => {
    const backupFile = createBackupFile();

    listRollbackSnapshotsMock.mockResolvedValue([]);
    previewEncryptedBackupMock.mockResolvedValue({
      createdAt: "2026-03-03T10:00:00.000Z",
      exportedAt: "2026-03-03T09:30:00.000Z",
      cases: 2,
      evidenceItems: 4,
      attachments: 1,
      exportBundles: 1,
      ledger: 6,
      snapshotSha256: "preview-sha",
      current: {
        cases: 1,
        evidenceItems: 1,
        attachments: 0,
        exportBundles: 0,
        ledger: 1,
      },
      diff: {
        cases: { overlapping: 0, incomingOnly: 2, currentOnly: 1 },
        evidenceItems: { overlapping: 0, incomingOnly: 4, currentOnly: 1 },
        attachments: { overlapping: 0, incomingOnly: 1, currentOnly: 0 },
        exportBundles: { overlapping: 0, incomingOnly: 1, currentOnly: 0 },
        ledger: { overlapping: 0, incomingOnly: 6, currentOnly: 1 },
      },
      options: {
        includeAttachments: true,
        includeExportBundles: true,
      },
    });
    importEncryptedBackupMock
      .mockResolvedValueOnce({
        status: "staged",
        stagedRestore: {
          stageId: "stage-restore-1",
          stagedAt: "2026-03-03T10:05:00.000Z",
          snapshotSha256: "preview-sha",
        },
      })
      .mockResolvedValueOnce({
        status: "restored",
        rollbackSnapshotId: "rollback-2026-03-03",
        cases: 2,
        evidenceItems: 4,
        attachments: 1,
        exportBundles: 1,
      });

    const view = await renderSecurity();

    try {
      const restoreCard = getSectionByHeading(view.container, "Restore encrypted backup");

      await waitFor(() => {
        expect(listRollbackSnapshotsMock).toHaveBeenCalledTimes(1);
      });

      await seedRestoreForm(restoreCard, backupFile, "restore-passphrase-42");

      await submitForm(restoreCard);

      await waitFor(() => {
        expect(previewEncryptedBackupMock).toHaveBeenCalledWith(backupFile, "restore-passphrase-42", {
          includeAttachments: true,
          includeExportBundles: true,
        });
        expect(view.container.textContent).toContain("Preview verified");
        expect(view.container.textContent).toContain("Dry-run overwrite report");
      });

      await clickButton(getButton(restoreCard, "Stage Restore"));

      await waitFor(() => {
        expect(importEncryptedBackupMock).toHaveBeenNthCalledWith(1, backupFile, "restore-passphrase-42", {
          includeAttachments: true,
          includeExportBundles: true,
        });
        expect(view.container.textContent).toContain("Restore staged");
        expect(view.container.textContent).toContain("Stage ID: stage-restore-1");
        expect(getButton(restoreCard, "Confirm Restore")).toBeDefined();
      });

      await clickButton(getButton(restoreCard, "Confirm Restore"));

      await waitFor(() => {
        expect(importEncryptedBackupMock).toHaveBeenNthCalledWith(2, backupFile, "restore-passphrase-42", {
          includeAttachments: true,
          includeExportBundles: true,
          confirmationToken: "stage-restore-1",
        });
        expect(view.container.textContent).toContain("Rollback snapshot rollback-2026-03-03 was captured automatically");
        expect(view.container.textContent).toContain("The vault is now locked; unlock with the restored vault passphrase.");
      });
    } finally {
      view.unmount();
    }
  });

  it("shows preview errors without staging a restore", async () => {
    const backupFile = createBackupFile();

    listRollbackSnapshotsMock.mockResolvedValue([]);
    previewEncryptedBackupMock.mockRejectedValue(new Error("Backup integrity check failed."));

    const view = await renderSecurity();

    try {
      const restoreCard = getSectionByHeading(view.container, "Restore encrypted backup");

      await seedRestoreForm(restoreCard, backupFile, "restore-passphrase-42");
      await submitForm(restoreCard);

      await waitFor(() => {
        expect(previewEncryptedBackupMock).toHaveBeenCalledTimes(1);
        expect(importEncryptedBackupMock).not.toHaveBeenCalled();
        expect(view.container.textContent).toContain("Backup integrity check failed.");
        expect(view.container.textContent).not.toContain("Preview verified");
        expect(getButton(restoreCard, "Stage Restore").disabled).toBe(true);
      });
    } finally {
      view.unmount();
    }
  });

  it("shows staged restore import failures and keeps the confirmation step unavailable", async () => {
    const backupFile = createBackupFile();

    listRollbackSnapshotsMock.mockResolvedValue([]);
    previewEncryptedBackupMock.mockResolvedValue({
      createdAt: "2026-03-03T10:00:00.000Z",
      exportedAt: "2026-03-03T09:30:00.000Z",
      cases: 2,
      evidenceItems: 4,
      attachments: 1,
      exportBundles: 1,
      ledger: 6,
      snapshotSha256: "preview-sha",
      current: {
        cases: 1,
        evidenceItems: 1,
        attachments: 0,
        exportBundles: 0,
        ledger: 1,
      },
      diff: {
        cases: { overlapping: 0, incomingOnly: 2, currentOnly: 1 },
        evidenceItems: { overlapping: 0, incomingOnly: 4, currentOnly: 1 },
        attachments: { overlapping: 0, incomingOnly: 1, currentOnly: 0 },
        exportBundles: { overlapping: 0, incomingOnly: 1, currentOnly: 0 },
        ledger: { overlapping: 0, incomingOnly: 6, currentOnly: 1 },
      },
      options: {
        includeAttachments: true,
        includeExportBundles: true,
      },
    });
    importEncryptedBackupMock.mockRejectedValue(new Error("Unable to stage restore snapshot."));

    const view = await renderSecurity();

    try {
      const restoreCard = getSectionByHeading(view.container, "Restore encrypted backup");

      await seedRestoreForm(restoreCard, backupFile, "restore-passphrase-42");
      await submitForm(restoreCard);

      await waitFor(() => {
        expect(view.container.textContent).toContain("Preview verified");
      });

      await clickButton(getButton(restoreCard, "Stage Restore"));

      await waitFor(() => {
        expect(importEncryptedBackupMock).toHaveBeenCalledWith(backupFile, "restore-passphrase-42", {
          includeAttachments: true,
          includeExportBundles: true,
        });
        expect(view.container.textContent).toContain("Unable to stage restore snapshot.");
        expect(view.container.textContent).not.toContain("Restore staged");
        expect(getButton(restoreCard, "Stage Restore")).toBeDefined();
      });
    } finally {
      view.unmount();
    }
  });

  it("arms rollback first and restores only after explicit confirmation", async () => {
    listRollbackSnapshotsMock
      .mockResolvedValueOnce([
        {
          id: "rollback-1",
          createdAt: "2026-03-03T11:00:00.000Z",
          reason: "pre-restore",
          snapshotSha256: "rollback-sha-1",
          exportedAt: "2026-03-03T10:59:00.000Z",
          counts: {
            cases: 1,
            evidenceItems: 2,
            attachments: 1,
            exportBundles: 0,
            ledger: 3,
          },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "rollback-2",
          createdAt: "2026-03-03T11:05:00.000Z",
          reason: "pre-rollback",
          snapshotSha256: "rollback-sha-2",
          exportedAt: "2026-03-03T11:04:00.000Z",
          counts: {
            cases: 1,
            evidenceItems: 2,
            attachments: 1,
            exportBundles: 0,
            ledger: 3,
          },
        },
      ]);
    restoreRollbackSnapshotMock.mockResolvedValue({
      status: "restored",
      rollbackSnapshotId: "rollback-2",
      cases: 1,
      evidenceItems: 2,
      attachments: 1,
      exportBundles: 0,
    });

    const view = await renderSecurity();

    try {
      const rollbackCard = getSectionByHeading(view.container, "Rollback snapshots");

      await waitFor(() => {
        expect(view.container.textContent).toContain("Rollback snapshots");
        expect(view.container.textContent).toContain("Captured 2026-03-03T11:00:00.000Z");
      });

      await clickButton(getButton(rollbackCard, "Arm Rollback"));

      await waitFor(() => {
        expect(restoreRollbackSnapshotMock).not.toHaveBeenCalled();
        expect(view.container.textContent).toContain("Rollback armed. Click the same restore button again");
        expect(getButton(rollbackCard, "Confirm Rollback")).toBeDefined();
      });

      await clickButton(getButton(rollbackCard, "Confirm Rollback"));

      await waitFor(() => {
        expect(restoreRollbackSnapshotMock).toHaveBeenCalledWith("rollback-1");
        expect(listRollbackSnapshotsMock).toHaveBeenCalledTimes(2);
        expect(view.container.textContent).toContain("Fresh rollback snapshot rollback-2 was captured before promotion");
      });
    } finally {
      view.unmount();
    }
  });

  it("shows rollback snapshot loading failures", async () => {
    listRollbackSnapshotsMock.mockRejectedValue(new Error("Unable to reach rollback snapshot store."));

    const view = await renderSecurity();

    try {
      await waitFor(() => {
        expect(listRollbackSnapshotsMock).toHaveBeenCalledTimes(1);
        expect(view.container.textContent).toContain("Unable to reach rollback snapshot store.");
      });
    } finally {
      view.unmount();
    }
  });

  it("shows rollback restore failures after explicit confirmation", async () => {
    listRollbackSnapshotsMock.mockResolvedValue([
      {
        id: "rollback-1",
        createdAt: "2026-03-03T11:00:00.000Z",
        reason: "pre-restore",
        snapshotSha256: "rollback-sha-1",
        exportedAt: "2026-03-03T10:59:00.000Z",
        counts: {
          cases: 1,
          evidenceItems: 2,
          attachments: 1,
          exportBundles: 0,
          ledger: 3,
        },
      },
    ]);
    restoreRollbackSnapshotMock.mockRejectedValue(new Error("Rollback snapshot promotion failed."));

    const view = await renderSecurity();

    try {
      const rollbackCard = getSectionByHeading(view.container, "Rollback snapshots");

      await waitFor(() => {
        expect(view.container.textContent).toContain("Captured 2026-03-03T11:00:00.000Z");
      });

      await clickButton(getButton(rollbackCard, "Arm Rollback"));

      await waitFor(() => {
        expect(getButton(rollbackCard, "Confirm Rollback")).toBeDefined();
      });

      await clickButton(getButton(rollbackCard, "Confirm Rollback"));

      await waitFor(() => {
        expect(restoreRollbackSnapshotMock).toHaveBeenCalledWith("rollback-1");
        expect(view.container.textContent).toContain("Rollback snapshot promotion failed.");
        expect(getButton(rollbackCard, "Confirm Rollback")).toBeDefined();
      });
    } finally {
      view.unmount();
    }
  });
});