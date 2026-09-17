declare module 'nodemailer' {
  export interface TransportOptions {
    host?: string;
    port?: number;
    secure?: boolean;
    auth?: { user?: string; pass?: string };
    tls?: { rejectUnauthorized?: boolean };
    timeout?: number;
    [key: string]: any;
  }

  export interface SendMailOptions {
    from?: string;
    to?: string;
    subject?: string;
    html?: string;
    text?: string;
    [key: string]: any;
  }

  export interface SentMessageInfo {
    messageId?: string;
    [key: string]: any;
  }

  export interface Transporter {
    sendMail(mailOptions: SendMailOptions): Promise<SentMessageInfo>;
    verify(): Promise<true>;
  }

  function createTransport(options?: any): Transporter;

  const _default: {
    createTransport: typeof createTransport;
    TransportOptions: TransportOptions;
  };

  export default _default;
}
