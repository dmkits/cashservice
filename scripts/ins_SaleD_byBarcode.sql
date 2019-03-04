
declare  @ProdID INT,/*@PPID,*/	@UM varchar(10),@Article2 varchar(42), @EmpID INT,@OperID INT,@CRID  INT
select @ProdID=p.ProdID, @UM=p.UM, @Article2=p.Article2
    from r_Prods p, r_ProdMQ mq where mq.ProdID=p.ProdID and mq.Barcode = @Barcode

select  @CRID=c.CRID from r_Crs c, r_CRSrvs r WHERE r.SrvID =c.SrvID AND c.FacID=@FacID;
select @OperID=OperID from  r_OperCrs WHERE CRID=@CRID AND CROperID = @CROperID
select @EmpID = EmpID from r_Opers where OperID=@OperID;

INSERT INTO t_SaleD( ChID, SrcPosID, ProdID, PPID, UM, Qty, BarCode, SecID,
  PriceCC_nt, SumCC_nt,	Tax, TaxSum, PriceCC_wt, SumCC_wt,
  PurPriceCC_nt, PurTax, PurPriceCC_wt,
  PLID, Discount, EmpID,
  CreateTime, ModifyTime, TaxTypeID, RealPrice, RealSum, IsFiscal)
VALUES  ( @ChID, @SrcPosID, @ProdID, @PPID, @UM, @Qty, @BarCode, @SecID,
  @PriceCC_nt, @SumCC_nt, @Tax, @TaxSum, @PriceCC_wt, @SumCC_wt,
	@PurPriceCC_nt, @PurTax, @PurPriceCC_wt, @PLID, @Discount, @EmpID,
	@CreateTime, @ModifyTime, @TaxTypeID, @RealPrice, @RealSum, @IsFiscal)
