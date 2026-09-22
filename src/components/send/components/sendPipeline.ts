import { ToAddrClass } from "../../appstate";
import Utils from "../../../utils/utils";
import { userFacingError } from "../../../utils/userFacingError";
import { native } from "../../../electronBridge";
import SendManyJsonType from "./SendManyJSONType";
import { recipientsToSendManyJSON } from "./getSendManyJSON";

/**
 * What the wallet can spend, and what a payment would cost.
 *
 * Lifted out of the Send screen unchanged so the SWARM Send screen and the
 * Overview's quick send can ask the same two questions the same way. There is
 * no second implementation of "can this be paid" anywhere, and there must not
 * be: a wallet with two ideas of what a valid payment costs will eventually
 * show one of them to a user and act on the other.
 */

export const ZATS_PER_ZEC: number = 10 ** 8;

/**
 * ZIP 317's marginal fee: the most one more output can add to a transaction's
 * fee. "Max" leaves this much room for each of the other rows' outputs. An
 * upper bound, so the figure errs toward a little left over rather than toward
 * a batch that cannot be paid.
 */
export const MARGINAL_FEE_ZATS: number = 5_000;

/**
 * Long enough that typing an amount does not ask the wallet for a proposal on
 * every keystroke.
 */
export const FEE_QUOTE_DEBOUNCE_MS: number = 300;

export const toZats = (amount: number): number => (Number.isFinite(amount) ? Math.round(amount * ZATS_PER_ZEC) : 0);

export const trimSpendable = (value: number): number => {
  const trimmed: number = Number(Utils.maxPrecisionTrimmed(value));
  return trimmed < 0 ? 0 : trimmed;
};

/**
 * What the wallet can send to `address`, fee included. With no address yet
 * there is nothing to price a fee against, so it is the spendable balance.
 */
export async function calculateSpendable(
  address: string,
  totalSpendableBalance: number,
): Promise<{ spendable: number; error: string }> {
  // transparent funds are not spendable.
  if (!address) {
    return { spendable: trimSpendable(totalSpendableBalance), error: "" };
  }
  try {
    const result: string = await native.get_spendable_balance_with_address(address, "false");
    if (!result) {
      return { spendable: 0, error: "" };
    }
    const resultJSON = JSON.parse(result);
    const spendable: number = resultJSON.spendable_balance ? resultJSON.spendable_balance / ZATS_PER_ZEC : 0;
    return { spendable: trimSpendable(spendable), error: "" };
  } catch (error: any) {
    // Two audiences, two messages. The console keeps the context — which of
    // this screen's calls failed — because that is what a bug report needs.
    // The screen gets the wallet's own last clause, because the layers in
    // front of it describe how the renderer reaches the wallet and say
    // nothing about the user's money.
    console.error(`Critical Error calculate spendable ${error}`);
    return { spendable: 0, error: userFacingError(error) };
  }
}

/** The fee of the one transaction that pays every recipient. */
export async function calculateSendFee(toaddrs: ToAddrClass[]): Promise<{ fee: number; error: string }> {
  try {
    const sendJson: SendManyJsonType[] = recipientsToSendManyJSON(toaddrs);
    const result: string = await native.send(JSON.stringify(sendJson));
    if (!result) {
      return { fee: 0, error: "" };
    }
    const resultJSON = JSON.parse(result);
    if (resultJSON.error) {
      return { fee: 0, error: resultJSON.error };
    }
    return { fee: resultJSON.fee ? resultJSON.fee / ZATS_PER_ZEC : 0, error: "" };
  } catch (error: any) {
    console.error(`Critical Error calculate send fee ${error}`);
    return { fee: 0, error: userFacingError(error) };
  }
}
