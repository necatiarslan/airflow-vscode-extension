
export class MethodResult<T> {
    public result: T;
    public isSuccessful: boolean;
    public error: Error | undefined;
    constructor() {
        this.result = undefined as unknown as T;
        this.isSuccessful = false;
        this.error = undefined;
    }
}