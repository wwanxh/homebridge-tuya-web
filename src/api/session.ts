export class Session {
  private _areaBaseUrl!: string;
  private expiresOn!: number;

  constructor(
    private _accessToken: string,
    private _refreshToken: string,
    private expiresIn: number,
    private _areaCode: string
  ) {
    this.areaCode = _areaCode;
    this.resetToken(_accessToken, _refreshToken, expiresIn);
  }

  public get accessToken(): string {
    return this._accessToken;
  }

  public get areaBaseUrl(): string {
    return this._areaBaseUrl;
  }

  public get refreshToken(): string {
    return this._refreshToken;
  }

  public set areaCode(newAreaCode: string) {
    const areaCodeLookup = {
      AY: "https://px1.tuyacn.com",
      EU: "https://px1.tuyaeu.com",
      US: "https://px1.tuyaus.com",
    };
    this._areaCode = newAreaCode;
    this._areaBaseUrl = areaCodeLookup[newAreaCode] || areaCodeLookup["US"];
  }

  public resetToken(accessToken, refreshToken, expiresIn): void {
    this._accessToken = accessToken;
    this._refreshToken = refreshToken;
    this.expiresOn = Session.getCurrentEpoch() + expiresIn;
  }

  public hasToken(): boolean {
    return !!this._accessToken;
  }

  public isTokenExpired(): boolean {
    return this.expiresOn < Session.getCurrentEpoch();
  }

  public hasValidToken(): boolean {
    return this.hasToken() && !this.isTokenExpired();
  }

  private static getCurrentEpoch(): number {
    return Math.round(new Date().getTime() / 1000);
  }
}
