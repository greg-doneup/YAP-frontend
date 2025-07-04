declare module 'howler' {
  export interface HowlOptions {
    src: string | string[];
    volume?: number;
    html5?: boolean;
    loop?: boolean;
    preload?: boolean | 'none' | 'metadata';
    autoplay?: boolean;
    mute?: boolean;
    sprite?: { [key: string]: [number, number] };
    rate?: number;
    pool?: number;
    format?: string[];
    xhr?: {
      method?: string;
      headers?: { [key: string]: string };
      withCredentials?: boolean;
    };
    onload?: () => void;
    onloaderror?: (id?: number, error?: any) => void;
    onplay?: (id?: number) => void;
    onpause?: (id?: number) => void;
    onstop?: (id?: number) => void;
    onend?: (id?: number) => void;
    onfade?: (id?: number) => void;
    onseek?: (id?: number) => void;
    onvolume?: (id?: number) => void;
    onrate?: (id?: number) => void;
    onmute?: (id?: number) => void;
    onunlock?: (id?: number) => void;
    onplayerror?: (id?: number, error?: any) => void;
  }

  export class Howl {
    constructor(options: HowlOptions);
    play(id?: number): number;
    pause(id?: number): this;
    stop(id?: number): this;
    mute(muted?: boolean, id?: number): boolean | this;
    volume(vol?: number, id?: number): number | this;
    fade(from: number, to: number, duration: number, id?: number): this;
    rate(rate?: number, id?: number): number | this;
    seek(seek?: number, id?: number): number | this;
    loop(loop?: boolean, id?: number): boolean | this;
    state(): 'unloaded' | 'loading' | 'loaded';
    playing(id?: number): boolean;
    duration(id?: number): number;
    on(event: string, callback: Function, id?: number): this;
    off(event?: string, callback?: Function, id?: number): this;
    once(event: string, callback: Function, id?: number): this;
    load(): this;
    unload(): void;
  }

  export class Howler {
    static mute(muted?: boolean): boolean;
    static volume(vol?: number): number;
    static codecs(ext: string): boolean;
    static unload(): void;
    static usingWebAudio: boolean;
    static noAudio: boolean;
    static autoSuspend: boolean;
    static autoUnlock: boolean;
    static ctx: AudioContext;
    static masterGain: GainNode;
  }
}
