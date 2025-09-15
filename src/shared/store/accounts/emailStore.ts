/**
 * @file Focused Zustand store for email data management
 */
import { create } from 'zustand';

export interface EmailHeader {
  uid: number;
  flags: string[];
  date: Date;
  from: { name?: string; address: string }[];
  to: { name?: string; address: string }[];
  cc?: { name?: string; address: string }[];
  bcc?: { name?: string; address: string }[];
  subject: string;
  messageId: string;
  inReplyTo?: string;
  references?: string[];
  size?: number;
  bodyStructure?: any;
}

export interface EmailState {
  emailHeaders: Record<string, Record<string, EmailHeader[]>>; // accountId -> mailboxPath -> headers
  selectedEmailUid: Record<string, number | null>; // accountId -> selected email UID
  emailBodies: Record<string, string>; // messageId -> body content
  
  // Email operations
  setEmailHeaders: (accountId: string, mailboxPath: string, headers: EmailHeader[]) => void;
  addEmailHeaders: (accountId: string, mailboxPath: string, headers: EmailHeader[]) => void;
  updateEmailHeader: (accountId: string, mailboxPath: string, uid: number, updates: Partial<EmailHeader>) => void;
  deleteEmailHeader: (accountId: string, mailboxPath: string, uid: number) => void;
  clearEmailHeaders: (accountId: string, mailboxPath?: string) => void;
  
  // Email selection
  selectEmail: (accountId: string, uid: number | null) => void;
  
  // Email body operations
  setEmailBody: (messageId: string, body: string) => void;
  clearEmailBody: (messageId: string) => void;
  clearAllEmailBodies: () => void;
  
  // Getters
  getEmailHeaders: (accountId: string, mailboxPath: string) => EmailHeader[];
  getSelectedEmailUid: (accountId: string) => number | null;
  getEmailBody: (messageId: string) => string | undefined;
  findEmailHeader: (accountId: string, mailboxPath: string, uid: number) => EmailHeader | undefined;
}

export const useEmailStore = create<EmailState>((set, get) => ({
  emailHeaders: {},
  selectedEmailUid: {},
  emailBodies: {},
  
  setEmailHeaders: (accountId: string, mailboxPath: string, headers: EmailHeader[]): void => set((state) => ({
    emailHeaders: {
      ...state.emailHeaders,
      [accountId]: {
        ...state.emailHeaders[accountId],
        [mailboxPath]: headers,
      },
    },
  })),
  
  addEmailHeaders: (accountId: string, mailboxPath: string, headers: EmailHeader[]): void => set((state) => {
    const existingHeaders = state.emailHeaders[accountId]?.[mailboxPath] ?? [];
    const mergedHeaders = [...existingHeaders, ...headers];
    
    return {
      emailHeaders: {
        ...state.emailHeaders,
        [accountId]: {
          ...state.emailHeaders[accountId],
          [mailboxPath]: mergedHeaders,
        },
      },
    };
  }),
  
  updateEmailHeader: (accountId: string, mailboxPath: string, uid: number, updates: Partial<EmailHeader>): void => set((state) => {
    const accountHeaders = state.emailHeaders[accountId] ?? {};
    const mailboxHeaders = accountHeaders[mailboxPath] ?? [];
    const updatedHeaders = mailboxHeaders.map(header =>
      header.uid === uid ? { ...header, ...updates } : header
    );
    
    return {
      emailHeaders: {
        ...state.emailHeaders,
        [accountId]: {
          ...accountHeaders,
          [mailboxPath]: updatedHeaders,
        },
      },
    };
  }),
  
  deleteEmailHeader: (accountId: string, mailboxPath: string, uid: number): void => set((state) => {
    const accountHeaders = state.emailHeaders[accountId] ?? {};
    const mailboxHeaders = accountHeaders[mailboxPath] ?? [];
    const filteredHeaders = mailboxHeaders.filter(header => header.uid !== uid);
    
    return {
      emailHeaders: {
        ...state.emailHeaders,
        [accountId]: {
          ...accountHeaders,
          [mailboxPath]: filteredHeaders,
        },
      },
      selectedEmailUid: {
        ...state.selectedEmailUid,
        [accountId]: state.selectedEmailUid[accountId] === uid ? null : state.selectedEmailUid[accountId],
      },
    };
  }),
  
  clearEmailHeaders: (accountId: string, mailboxPath?: string): void => set((state) => {
    if (mailboxPath) {
      // Clear specific mailbox
      const accountHeaders = state.emailHeaders[accountId] ?? {};
      const { [mailboxPath]: _, ...restMailboxes } = accountHeaders;
      
      return {
        emailHeaders: {
          ...state.emailHeaders,
          [accountId]: restMailboxes,
        },
      };
    } else {
      // Clear all mailboxes for account
      const { [accountId]: _, ...restAccounts } = state.emailHeaders;
      const { [accountId]: __, ...restSelected } = state.selectedEmailUid;
      
      return {
        emailHeaders: restAccounts,
        selectedEmailUid: restSelected,
      };
    }
  }),
  
  selectEmail: (accountId: string, uid: number | null): void => set((state) => ({
    selectedEmailUid: {
      ...state.selectedEmailUid,
      [accountId]: uid,
    },
  })),
  
  setEmailBody: (messageId: string, body: string): void => set((state) => ({
    emailBodies: {
      ...state.emailBodies,
      [messageId]: body,
    },
  })),
  
  clearEmailBody: (messageId: string): void => set((state) => {
    const { [messageId]: _, ...rest } = state.emailBodies;
    return { emailBodies: rest };
  }),
  
  clearAllEmailBodies: (): void => set({
    emailBodies: {},
  }),
  
  getEmailHeaders: (accountId: string, mailboxPath: string): EmailHeader[] => {
    return get().emailHeaders[accountId]?.[mailboxPath] ?? [];
  },
  
  getSelectedEmailUid: (accountId: string): number | null => {
    return get().selectedEmailUid[accountId] ?? null;
  },
  
  getEmailBody: (messageId: string): string | undefined => {
    return get().emailBodies[messageId];
  },
  
  findEmailHeader: (accountId: string, mailboxPath: string, uid: number): EmailHeader | undefined => {
    const headers = get().emailHeaders[accountId]?.[mailboxPath] ?? [];
    return headers.find(header => header.uid === uid);
  },
}));
