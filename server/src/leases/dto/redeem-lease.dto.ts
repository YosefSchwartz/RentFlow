import { IsString, MinLength, MaxLength } from 'class-validator';

/** A tenant redeems a lease activation code to connect to the lease. */
export class RedeemLeaseDto {
  @IsString()
  @MinLength(6)
  @MaxLength(40)
  code: string;
}
