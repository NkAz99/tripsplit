// js/settlement.js - Pure mathematical settlement and debt simplification algorithms (Zero DOM dependencies)
window.TripSplit = window.TripSplit || {};

(function() {
  /**
   * Distribute remainder cents deterministically using a rotation offset.
   * Ensures that sum of returned shares matches totalMinor exactly.
   *
   * @param {number} totalMinor - Total amount in minor units (integer)
   * @param {string[]} participantIds - Array of participant IDs
   * @param {number} rotationIndex - Rotation index to rotate who gets the extra cent
   * @returns {Object.<string, number>} Map of participantId -> share in minor units
   */
  function splitEqual(totalMinor, participantIds, rotationIndex = 0) {
    if (!participantIds || participantIds.length === 0) return {};
    const n = participantIds.length;
    const baseShare = Math.floor(totalMinor / n);
    const remainder = totalMinor % n;

    const shares = {};
    for (let i = 0; i < n; i++) {
      shares[participantIds[i]] = baseShare;
    }

    // Deterministically distribute remainder cents
    const startIdx = Math.abs(rotationIndex) % n;
    for (let r = 0; r < remainder; r++) {
      const idx = (startIdx + r) % n;
      shares[participantIds[idx]] += 1;
    }

    return shares;
  }

  /**
   * Validate custom split amounts.
   *
   * @param {number} totalMinor
   * @param {Object.<string, number>} customShares
   * @returns {{ valid: boolean, sum: number, diff: number }}
   */
  function validateCustomSplit(totalMinor, customShares) {
    let sum = 0;
    for (const val of Object.values(customShares || {})) {
      sum += Math.round(Number(val) || 0);
    }
    const diff = totalMinor - sum;
    return {
      valid: diff === 0,
      sum,
      diff
    };
  }

  /**
   * Hybrid custom split calculation.
   * Participants with filled amounts (including explicit 0) pay that fixed amount.
   * Participants whose amounts are empty/null/undefined take an equal share of the remainder.
   * Remainder cents are distributed one by one rotating deterministically by rotationIndex.
   *
   * @param {number} totalMinor - Total amount in minor units
   * @param {string[]} checkedParticipantIds - Only checked participants
   * @param {Object.<string, number|null|undefined>} filledSharesMinor - ParticipantId -> filled minor amount
   * @param {number} rotationIndex - Rotation offset for remainder cents
   * @returns {{ valid: boolean, error?: string, shares: Object.<string, number>, filledSum: number, remainder: number, emptyIds: string[], diff?: number }}
   */
  function splitHybrid(totalMinor, checkedParticipantIds, filledSharesMinor = {}, rotationIndex = 0) {
    if (!checkedParticipantIds || checkedParticipantIds.length === 0) {
      return { valid: false, error: 'no_participants', shares: {}, filledSum: 0, remainder: totalMinor, emptyIds: [] };
    }

    let filledSum = 0;
    const emptyIds = [];
    const shares = {};

    for (const id of checkedParticipantIds) {
      const val = filledSharesMinor[id];
      if (val !== undefined && val !== null && val !== '') {
        const numVal = Math.round(Number(val));
        if (isNaN(numVal) || numVal < 0) {
          return { valid: false, error: 'negative_or_invalid', shares: {}, filledSum, remainder: 0, emptyIds };
        }
        shares[id] = numVal;
        filledSum += numVal;
      } else {
        emptyIds.push(id);
      }
    }

    const remainder = totalMinor - filledSum;

    // Case 1: All participants are filled
    if (emptyIds.length === 0) {
      if (remainder !== 0) {
        return {
          valid: false,
          error: remainder < 0 ? 'excess' : 'sum_mismatch',
          shares,
          filledSum,
          remainder,
          emptyIds,
          diff: Math.abs(remainder)
        };
      }
      return {
        valid: true,
        shares,
        filledSum,
        remainder: 0,
        emptyIds
      };
    }

    // Case 2: Some fields are empty
    if (remainder < 0) {
      return {
        valid: false,
        error: 'excess',
        shares,
        filledSum,
        remainder,
        emptyIds,
        diff: Math.abs(remainder)
      };
    }

    if (remainder === 0) {
      for (const id of emptyIds) {
        shares[id] = 0;
      }
      return {
        valid: true,
        shares,
        filledSum,
        remainder: 0,
        emptyIds
      };
    }

    // remainder > 0: split equally among emptyIds
    const autoShares = splitEqual(remainder, emptyIds, rotationIndex);
    for (const [id, share] of Object.entries(autoShares)) {
      shares[id] = share;
    }

    return {
      valid: true,
      shares,
      filledSum,
      remainder,
      emptyIds
    };
  }

  /**
   * Helper to construct a validated expense object with exact convertedAmountMinor and custom/hybrid shares.
   */
  function buildExpense({
    id,
    title,
    category = 'other',
    amountMinor,
    currency: expCurrency,
    baseCurrency,
    rate = 1.0,
    rateSource = 'live',
    paidBy,
    date = new Date().toISOString().split('T')[0],
    splitType = 'equal',
    splitAmong,
    filledSharesMinor = {},
    rotationIndex = 0
  }) {
    const convertedAmountMinor = (expCurrency === baseCurrency || rate === 1.0)
      ? Math.round(amountMinor)
      : Math.round(amountMinor * rate);

    let customSplits = null;
    let manualSplits = null;
    let manualParticipantIds = [];

    if (splitType === 'custom') {
      const hybrid = splitHybrid(amountMinor, splitAmong, filledSharesMinor, rotationIndex);
      if (!hybrid.valid) {
        const err = new Error(hybrid.error);
        err.diff = hybrid.diff;
        err.filledSum = hybrid.filledSum;
        err.total = amountMinor;
        throw err;
      }
      manualSplits = { ...filledSharesMinor };
      manualParticipantIds = Object.keys(filledSharesMinor);

      if (expCurrency === baseCurrency || rate === 1.0) {
        customSplits = hybrid.shares;
      } else {
        customSplits = {};
        let allocated = 0;
        splitAmong.forEach((pId, idx) => {
          if (idx === splitAmong.length - 1) {
            customSplits[pId] = convertedAmountMinor - allocated;
          } else {
            const converted = Math.round(hybrid.shares[pId] * rate);
            customSplits[pId] = converted;
            allocated += converted;
          }
        });
      }
    }

    return {
      id: id || ('exp_' + Date.now()),
      title,
      category,
      amountMinor,
      currency: expCurrency,
      paidBy,
      date,
      splitType,
      splitAmong,
      customSplits,
      manualSplits,
      manualParticipantIds,
      rateSnapshot: {
        from: expCurrency,
        to: baseCurrency,
        rate,
        source: rateSource,
        date: new Date().toISOString().split('T')[0]
      },
      convertedAmountMinor
    };
  }

  /**
   * Calculate all balances, total costs, and category totals for a trip.
   *
   * @param {Object} trip - The trip object containing participants, expenses, settlements
   * @returns {Object} { balances, paidTotals, fairShareTotals, totalCostMinor, categoryTotals, isZeroSum }
   */
  function calculateBalances(trip) {
    const balances = {};
    const paidTotals = {};
    const fairShareTotals = {};
    const categoryTotals = {
      food: 0,
      transport: 0,
      accommodation: 0,
      entertainment: 0,
      other: 0
    };

    if (!trip || !Array.isArray(trip.participants)) {
      return { balances, paidTotals, fairShareTotals, totalCostMinor: 0, categoryTotals, isZeroSum: true };
    }

    // Initialize all participants
    for (const p of trip.participants) {
      balances[p.id] = 0;
      paidTotals[p.id] = 0;
      fairShareTotals[p.id] = 0;
    }

    let totalCostMinor = 0;

    // Process expenses
    if (Array.isArray(trip.expenses)) {
      trip.expenses.forEach((expense, expIdx) => {
        const costMinor = Math.round(expense.convertedAmountMinor || 0);
        totalCostMinor += costMinor;

        const cat = expense.category || 'other';
        if (categoryTotals[cat] !== undefined) {
          categoryTotals[cat] += costMinor;
        } else {
          categoryTotals.other += costMinor;
        }

        // Paid by
        const payerId = expense.paidBy;
        if (paidTotals[payerId] !== undefined) {
          paidTotals[payerId] += costMinor;
        }

        // Shares
        let shares = {};
        if (expense.splitType === 'custom' && expense.customSplits) {
          shares = expense.customSplits;
        } else {
          const splitAmong = Array.isArray(expense.splitAmong) && expense.splitAmong.length > 0
            ? expense.splitAmong
            : trip.participants.map(p => p.id);
          shares = splitEqual(costMinor, splitAmong, expIdx);
        }

        for (const [pId, shareMinor] of Object.entries(shares)) {
          const share = Math.round(shareMinor || 0);
          if (fairShareTotals[pId] !== undefined) {
            fairShareTotals[pId] += share;
          }
        }
      });
    }

    // Initial net balances from expenses: Net = Paid - FairShare
    for (const p of trip.participants) {
      balances[p.id] = paidTotals[p.id] - fairShareTotals[p.id];
    }

    // Process settlements: From pays To amountMinor
    // Payer's balance increases (+amount), Receiver's balance decreases (-amount)
    if (Array.isArray(trip.settlements)) {
      for (const s of trip.settlements) {
        const amt = Math.round(s.amountMinor || 0);
        if (balances[s.from] !== undefined) {
          balances[s.from] += amt;
        }
        if (balances[s.to] !== undefined) {
          balances[s.to] -= amt;
        }
      }
    }

    // Assert zero-sum invariant
    let sum = 0;
    for (const b of Object.values(balances)) {
      sum += b;
    }
    const isZeroSum = (sum === 0);

    return {
      balances,
      paidTotals,
      fairShareTotals,
      totalCostMinor,
      categoryTotals,
      isZeroSum,
      balanceSum: sum
    };
  }

  /**
   * Greedy debt simplification algorithm.
   * Matches largest debtor with largest creditor.
   * Produces at most (n - 1) transfers.
   *
   * @param {Object.<string, number>} netBalances - Map of participantId -> net balance in minor units
   * @returns {Array<{ from: string, to: string, amountMinor: number }>}
   */
  function simplifyDebts(netBalances) {
    const debtors = [];
    const creditors = [];

    for (const [id, balance] of Object.entries(netBalances)) {
      const val = Math.round(balance);
      if (val < -0.01) {
        debtors.push({ id, amount: -val }); // amount > 0
      } else if (val > 0.01) {
        creditors.push({ id, amount: val }); // amount > 0
      }
    }

    const transfers = [];

    while (debtors.length > 0 && creditors.length > 0) {
      // Sort debtors and creditors descending by amount
      debtors.sort((a, b) => b.amount - a.amount);
      creditors.sort((a, b) => b.amount - a.amount);

      const debtor = debtors[0];
      const creditor = creditors[0];

      const settleAmount = Math.min(debtor.amount, creditor.amount);

      if (settleAmount > 0) {
        transfers.push({
          from: debtor.id,
          to: creditor.id,
          amountMinor: settleAmount
        });

        debtor.amount -= settleAmount;
        creditor.amount -= settleAmount;
      }

      if (debtor.amount <= 0) {
        debtors.shift();
      }
      if (creditor.amount <= 0) {
        creditors.shift();
      }
    }

    return transfers;
  }

  /**
   * Assert zero-sum balance invariant.
   *
   * @param {Object.<string, number>} balances
   * @throws {Error} if sum of balances != 0
   */
  function assertZeroSum(balances) {
    let sum = 0;
    for (const val of Object.values(balances || {})) {
      sum += Math.round(Number(val) || 0);
    }
    if (sum !== 0) {
      throw new Error(`Zero-sum invariant violated: balance sum is ${sum} minor units.`);
    }
    return true;
  }

  window.TripSplit.settlement = {
    splitEqual,
    validateCustomSplit,
    splitHybrid,
    buildExpense,
    calculateBalances,
    simplifyDebts,
    assertZeroSum
  };
})();
