// This tells TypeScript/VS Code that the 'electronAPI' object exists on the global window object.
export interface IElectronAPI {
    isElectron: boolean,
    signInWithGoogle: () => Promise<any>,
    log: (level: string, message: string) => void,
    minimize: () => void,
    maximize: () => void,
    close: () => void,
}

declare global {
    interface Window {
        electronAPI: IElectronAPI
    }
}