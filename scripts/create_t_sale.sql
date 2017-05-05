declare @NewChID INT
        select @NewChID =ISNULL(MAX(ChID),0)+1

        INSERT into t_sale
        (ChID,  DocID, DocDate, KursMC,  OurID,
        StockID,    CompID,    CodeID1,    CodeID2,    CodeID3,
        CodeID4, CodeID5,    Discount,    Notes,    CRID,
        OperID,    CreditID,    DocTime,    DCardID,    EmpID,
        IntDocID, CashSumCC,    ChangeSumCC,    CurrID,    TSumCC_nt,
        TTaxSum,    TSumCC_wt,    StateCode,    DeskCode,    Visitors,
        TPurSumCC_nt, TPurTaxSum,    TPurSumCC_wt,    DocCreateTime,    TRealSum,
        TLevySum)
        VALUES
        (@NewChID,  @DocID, @DocDate, 1.0,  1,
        1,    1,    0,    0,    0,
        0, 0,    1.0,    null,    1,
        @OperID ,null,    @DocTime,    'нет дисконтной карты',    1,
        null, @CashSumCC,    @ChangeSumCC,    980,    0,
        @TTaxSum,    @TSumCC_wt,    4,    1,    0,
        0, 0,    0,    @DocCreateTime,    0,
        0)



