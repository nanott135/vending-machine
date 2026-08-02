import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { CoinDenomination, MachineBalance, ReturnCoinsResult } from '../models/coin.model';
import { PurchaseResult } from '../models/purchase-result.model';
import { API_BASE_URL } from './api-config';

@Injectable({ providedIn: 'root' })
export class MachineService {
  private readonly http = inject(HttpClient);

  getBalance(): Observable<MachineBalance> {
    return this.http.get<MachineBalance>(`${API_BASE_URL}/machine/balance`);
  }

  insertCoin(denomination: CoinDenomination): Observable<MachineBalance> {
    return this.http.post<MachineBalance>(`${API_BASE_URL}/machine/coins`, { denomination });
  }

  returnCoins(): Observable<ReturnCoinsResult> {
    return this.http.post<ReturnCoinsResult>(`${API_BASE_URL}/machine/coins/return`, {});
  }

  purchase(productCode: string): Observable<PurchaseResult> {
    return this.http.post<PurchaseResult>(`${API_BASE_URL}/purchase`, { productCode });
  }
}
