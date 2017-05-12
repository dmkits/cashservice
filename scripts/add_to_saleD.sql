


-- select @ProdID = ProdID from r_Prods where Article2 = @Article2
-- select @UM = UM from r_Prods where Article2 = @Article2

declare  @ProdID INT,/*@PPID,*/	@UM varchar(10),@BarCode varchar(42), @EmpID INT
select @ProdID=p.ProdID, @UM=p.UM, @Barcode=mq.Barcode
    from r_Prods p
    INNER JOIN r_ProdMQ mq ON mq.ProdID=p.ProdID
where p.Article2 = @Article2

select @EmpID = EmpID from r_Opers
where OperID=@OperID;

INSERT INTO t_SaleD
                ( ChID,	SrcPosID,	ProdID,	PPID,	UM,
                  Qty,	PriceCC_nt,	SumCC_nt,	Tax,	TaxSum,
                  PriceCC_wt, SumCC_wt,	BarCode,	SecID,	PurPriceCC_nt,
                  PurTax,	PurPriceCC_wt,	PLID,	Discount,	EmpID,
                  CreateTime,	ModifyTime,	TaxTypeID,	RealPrice,	RealSum)
VALUES
                ( @ChID,	@SrcPosID,	@ProdID,	0/*@PPID*/,	@UM,
                  @Qty,	@PriceCC_nt,	@SumCC_nt,	@Tax,	@TaxSum,
                  @PriceCC_wt, @SumCC_wt,	@BarCode,	1,	@PurPriceCC_nt,
                  @PurTax,	@PurPriceCC_wt,	0,	0.0,	@EmpID,
                  @CreateTime,	@ModifyTime,	0/*TaxTypeID*/,	@RealPrice,	@RealSum)