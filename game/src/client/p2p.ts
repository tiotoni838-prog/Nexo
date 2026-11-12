import type { ClientMsg, ServerMsg } from '../shared/protocol.js';

const ICE_SERVERS: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];

export interface P2PEndpoint {
  send(msg: ServerMsg | ClientMsg): void;
  close(): void;
  readonly open: boolean;
}

const compress = (s: string): string => btoa(unescape(encodeURIComponent(s)));
const decompress = (s: string): string => decodeURIComponent(escape(atob(s.trim())));

export class P2PHost {
  private pc: RTCPeerConnection | null = null;
  private channel: RTCDataChannel | null = null;

  async createOffer(): Promise<string> {
    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.channel = this.pc.createDataChannel('nexo', { ordered: true });
    let resolveGathered: (code: string) => void = () => {};
    const offerPromise = new Promise<string>((resolve) => {
      resolveGathered = resolve;
      this.pc!.onicegatheringstatechange = () => {
        if (this.pc!.iceGatheringState === 'complete') {
          resolveGathered(compress(JSON.stringify(this.pc!.localDescription)));
        }
      };
    });
    await this.pc.setLocalDescription(await this.pc.createOffer());
    setTimeout(() => resolveGathered(compress(JSON.stringify(this.pc!.localDescription))), 3000);
    return offerPromise;
  }

  async acceptAnswer(code: string): Promise<void> {
    if (!this.pc) throw new Error('no-offer');
    await this.pc.setRemoteDescription(JSON.parse(decompress(code)));
  }

  get dataChannel(): RTCDataChannel | null {
    return this.channel;
  }
}

export class P2PGuest {
  private pc: RTCPeerConnection | null = null;
  private channel: RTCDataChannel | null = null;

  async join(offerCode: string, onMessage: (msg: ServerMsg) => void): Promise<string> {
    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    let resolveGathered: (code: string) => void = () => {};
    const answerPromise = new Promise<string>((resolve) => {
      resolveGathered = resolve;
      this.pc!.onicegatheringstatechange = () => {
        if (this.pc!.iceGatheringState === 'complete') {
          resolveGathered(compress(JSON.stringify(this.pc!.localDescription)));
        }
      };
    });
    this.pc.ondatachannel = (ev) => {
      this.channel = ev.channel;
      this.channel.onmessage = (msgEv) => {
        try {
          onMessage(JSON.parse(String(msgEv.data)) as ServerMsg);
        } catch {
          // ignore malformed frames
        }
      };
    };
    await this.pc.setRemoteDescription(JSON.parse(decompress(offerCode)));
    await this.pc.setLocalDescription(await this.pc.createAnswer());
    setTimeout(() => resolveGathered(compress(JSON.stringify(this.pc!.localDescription))), 3000);
    return answerPromise;
  }

  send(msg: ClientMsg): void {
    if (this.channel?.readyState === 'open') this.channel.send(JSON.stringify(msg));
  }

  close(): void {
    this.pc?.close();
    this.pc = null;
    this.channel = null;
  }
}
