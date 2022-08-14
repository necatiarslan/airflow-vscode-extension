/* eslint-disable @typescript-eslint/naming-convention */

export class MethodResult<T> {
    public result: T;
    public isSuccessful: boolean;
    public error: Error;
}