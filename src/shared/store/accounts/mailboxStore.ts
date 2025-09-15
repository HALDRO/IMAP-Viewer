/**
 * @file Focused Zustand store for mailbox management
 */
import { create } from 'zustand';

export interface Mailbox {
  name: string;
  path: string;
  delimiter: string;
  flags: string[];
  specialUse?: string;
  subscribed?: boolean;
  children?: Mailbox[];
}

export interface MailboxState {
  mailboxes: Record<string, Mailbox[]>; // accountId -> mailboxes
  selectedMailbox: Record<string, string | null>; // accountId -> selected mailbox path
  
  // Mailbox operations
  setMailboxes: (accountId: string, mailboxes: Mailbox[]) => void;
  addMailbox: (accountId: string, mailbox: Mailbox) => void;
  updateMailbox: (accountId: string, path: string, updates: Partial<Mailbox>) => void;
  deleteMailbox: (accountId: string, path: string) => void;
  clearMailboxes: (accountId: string) => void;
  
  // Mailbox selection
  selectMailbox: (accountId: string, path: string | null) => void;
  
  // Getters
  getMailboxes: (accountId: string) => Mailbox[];
  getSelectedMailbox: (accountId: string) => string | null;
  findMailbox: (accountId: string, path: string) => Mailbox | undefined;
}

export const useMailboxStore = create<MailboxState>((set, get) => ({
  mailboxes: {},
  selectedMailbox: {},
  
  setMailboxes: (accountId: string, mailboxes: Mailbox[]): void => set((state) => ({
    mailboxes: {
      ...state.mailboxes,
      [accountId]: mailboxes,
    },
  })),
  
  addMailbox: (accountId: string, mailbox: Mailbox): void => set((state) => ({
    mailboxes: {
      ...state.mailboxes,
      [accountId]: [...(state.mailboxes[accountId] ?? []), mailbox],
    },
  })),
  
  updateMailbox: (accountId: string, path: string, updates: Partial<Mailbox>): void => set((state) => {
    const accountMailboxes = state.mailboxes[accountId] ?? [];
    const updatedMailboxes = accountMailboxes.map(mailbox =>
      mailbox.path === path ? { ...mailbox, ...updates } : mailbox
    );
    
    return {
      mailboxes: {
        ...state.mailboxes,
        [accountId]: updatedMailboxes,
      },
    };
  }),
  
  deleteMailbox: (accountId: string, path: string): void => set((state) => {
    const accountMailboxes = state.mailboxes[accountId] ?? [];
    const filteredMailboxes = accountMailboxes.filter(mailbox => mailbox.path !== path);
    
    return {
      mailboxes: {
        ...state.mailboxes,
        [accountId]: filteredMailboxes,
      },
      selectedMailbox: {
        ...state.selectedMailbox,
        [accountId]: state.selectedMailbox[accountId] === path ? null : state.selectedMailbox[accountId],
      },
    };
  }),
  
  clearMailboxes: (accountId: string): void => set((state) => {
    const { [accountId]: _, ...restMailboxes } = state.mailboxes;
    const { [accountId]: __, ...restSelected } = state.selectedMailbox;
    
    return {
      mailboxes: restMailboxes,
      selectedMailbox: restSelected,
    };
  }),
  
  selectMailbox: (accountId: string, path: string | null): void => set((state) => ({
    selectedMailbox: {
      ...state.selectedMailbox,
      [accountId]: path,
    },
  })),
  
  getMailboxes: (accountId: string): Mailbox[] => {
    return get().mailboxes[accountId] ?? [];
  },
  
  getSelectedMailbox: (accountId: string): string | null => {
    return get().selectedMailbox[accountId] ?? null;
  },
  
  findMailbox: (accountId: string, path: string): Mailbox | undefined => {
    const mailboxes = get().mailboxes[accountId] ?? [];
    return mailboxes.find(mailbox => mailbox.path === path);
  },
}));
