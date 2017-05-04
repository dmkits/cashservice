
<!--t_sale-->
         <!--ChID,  DocID, DocDate, KursMC,  OurID,	StockI.D,    CompID,	CodeID1,	CodeID2,	CodeID3,	CodeID4,-->
         <!--CodeID5,	Discount,	Notes,	CRID,	OperID,	CreditID,	DocTime,	DCardID,	EmpID,	IntDocID,-->
        <!--CashSumCC,	ChangeSumCC,	CurrID,	TSumCC_nt,	TTaxSum	TSumCC_wt,	StateCode,	DeskCode,	Visitors,-->
        <!--TPurSumCC_nt,	TPurTaxSum,	TPurSumCC_wt,	DocCreateTime,	TRealSum,	TLevySum-->




<!--t_SaleD-->

        <!--ChID,	SrcPosID,	ProdID,	PPID,	UM,	Qty,	PriceCC_nt,	SumCC_nt,	Tax,	TaxSum,	PriceCC_wt,-->
        <!--SumCC_wt,	BarCode,	SecID,	PurPriceCC_nt,	PurTax,	PurPriceCC_wt,	PLID,	Discount,	EmpID,-->
        <!--CreateTime,	ModifyTime,	TaxTypeID,	RealPrice,	RealSum,-->

        declare @NewChID INT ,
                 @DocDate, @OurID, @StockID, @CompID, @CRID
        select @NewChID =ISNULL(MAX(ChID),0)+1,

        INSERT into t_sale
                            (ChID,  DocID, DocDate, KursMC,  OurID,
                            StockID,    CompID,	CodeID1,	CodeID2,	CodeID3,
                            CodeID4, CodeID5,	Discount,	Notes,	CRID,
                            OperID,	CreditID,	DocTime,	DCardID,	EmpID,
                            IntDocID, CashSumCC,	ChangeSumCC,	CurrID,	TSumCC_nt,
                            TTaxSum,	TSumCC_wt,	StateCode,	DeskCode,	Visitors,
                            TPurSumCC_nt, TPurTaxSum,	TPurSumCC_wt,	DocCreateTime,	TRealSum,
                            TLevySum)

        VALUES
                            (@NewChID,  @DocID, DocDate, 1.0,  OurID,
                            StockID,    CompID,	0,	0,	0,
                            0, 0,	1.0,	'',	CRID,
                            1,	'',	@DocTime,	'нет дисконтной карты',	1,
                            null,CashSumCC,	ChangeSumCC,	980,	TSumCC_nt,
                            TTaxSum,	@TSumCC_wt,	StateCode,	DeskCode,	0,
                            TPurSumCC_nt, TPurTaxSum,	TPurSumCC_wt,	@DocTime,	TRealSum,
                            TLevySum)