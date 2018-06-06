
-- select @ProdID = ProdID from r_Prods where Article2 = @Article2
-- select @UM = UM from r_Prods where Article2 = @Article2

declare  @ProdID INT,/*@PPID,*/	@UM varchar(10),@Article2 varchar(42), @EmpID INT,@OperID INT,@CRID  INT
select @ProdID=p.ProdID, @UM=p.UM, @Article2=p.Article2
    from r_Prods p
    INNER JOIN r_ProdMQ mq ON mq.ProdID=p.ProdID
where mq.Barcode = @Barcode

select  @CRID=c.CRID
from r_Crs c
INNER JOIN r_CRSrvs r ON r.SrvID =c.SrvID
WHERE c.FacID=@FacID;

select @OperID=OperID from  r_OperCrs
WHERE CRID=@CRID AND CROperID = @CROperID

select @EmpID = EmpID from r_Opers
where OperID=@OperID;

INSERT INTO t_SaleD
                ( ChID,	SrcPosID,	ProdID,	PPID,	UM,
                  Qty,	PriceCC_nt,	SumCC_nt,	Tax,	TaxSum,
                  PriceCC_wt, SumCC_wt,	BarCode,	SecID,	PurPriceCC_nt,
                  PurTax,	PurPriceCC_wt,	PLID,	Discount,	EmpID,
                  CreateTime,	ModifyTime,	TaxTypeID,	RealPrice,	RealSum, IsFiscal)
VALUES
                ( @ChID,	@SrcPosID,	@ProdID,	@PPID,	@UM,
                  @Qty,	@PriceCC_nt,	@SumCC_nt,	@Tax,	@TaxSum,
                  @PriceCC_wt, @SumCC_wt,	@BarCode,	@SecID,	@PurPriceCC_nt,
                  @PurTax,	@PurPriceCC_wt,	@PLID,	@Discount,	@EmpID,
                  @CreateTime,	@ModifyTime,	@TaxTypeID,	@RealPrice,	@RealSum, @IsFiscal)


--SELECT ChID,SrcPosID,ProdID