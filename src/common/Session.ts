import { AirflowApi } from "./Api";
import { ServerConfig } from '../common/Types';
import * as ui from '../common/UI';

export class Session {
	public static Current: Session | undefined;

    public Api: AirflowApi | undefined;
    public Server: ServerConfig | undefined;

	public constructor() {
		Session.Current = this;
	}

    public SaveState() {
        ui.logToOutput('Saving state...');
        
    }

    public LoadState() {
        ui.logToOutput('Loading state...');
    }

	public dispose() {
		Session.Current = undefined;
	}
}