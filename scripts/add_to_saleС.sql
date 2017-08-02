declare  @ProdID INT,/*@PPID,*/	@UM varchar(10),@BarCode varchar(42), @EmpID INT,@OperID INT,@CRID  INT
select @ProdID=p.ProdID, @UM=p.UM, @Barcode=mq.Barcode
    from r_Prods p
    INNER JOIN r_ProdMQ mq ON mq.ProdID=p.ProdID
where p.Article2 = @Article2

select  @CRID=c.CRID
from r_Crs c
INNER JOIN r_CRSrvs r ON r.SrvID =c.SrvID
WHERE c.FacID=@FacID;

select @OperID=OperID from  r_OperCrs
WHERE CRID=@CRID AND CROperID = @CROperID

select @EmpID = EmpID from r_Opers
where OperID=@OperID;

INSERT INTO t_SaleC
                ( ChID,	SrcPosID,	ProdID,	UM,
                  Qty,	PriceCC_nt,	SumCC_nt,	Tax,	TaxSum,
                  PriceCC_wt, SumCC_wt,	BarCode,	CReasonID,	EmpID,
                  CreateTime,	ModifyTime)
VALUES
                ( @ChID,	@SrcPosID,	@ProdID,	@UM,
                  @Qty,	@PriceCC_nt,	@SumCC_nt,	@Tax,	@TaxSum,
                  @PriceCC_wt, @SumCC_wt,	@BarCode,	0,	@EmpID,
                  @CreateTime,	@ModifyTime)