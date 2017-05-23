-- declare @NewChID INT
-- select @NewChID =ISNULL(MAX(ChID),0)+1 from t_sale

declare @NewChID INT
exec dbo.z_NewChID 't_sale', @NewChID OUTPUT

declare @StockID INT, @CRID SMALLINT, @OperID INT, @EmpID INT, @OurID INT

select @StockID=c.StockID, @CRID=c.CRID, @OurID = r.OurID
from r_Crs c
INNER JOIN r_CRSrvs r ON r.SrvID =c.SrvID
WHERE c.FacID=@FacID;


select @OperID=OperID from  r_OperCrs
WHERE CRID=@CRID AND CROperID = @CROperID

select @EmpID = EmpID from r_Opers
where OperID=@OperID;

INSERT into t_sale
        (CHID,  DocID, DocDate, KursMC,  OurID,
        StockID,    CompID,    CodeID1,    CodeID2,    CodeID3,
        CodeID4, CodeID5,    Discount,    Notes,    CRID,
        OperID,    CreditID,    DocTime,    DCardID,    EmpID,
        IntDocID, CashSumCC,    ChangeSumCC,    CurrID,    TSumCC_nt,
        TTaxSum,    TSumCC_wt,    StateCode,    DeskCode,    Visitors,
        TPurSumCC_nt, TPurTaxSum,    TPurSumCC_wt,    DocCreateTime,    TRealSum,
        TLevySum)
VALUES
        (@NewChID,  @DocID, @DocDate, 1.0, @OurID,
        @StockID,    1,    0,    0,    0,
        0, 0,    1.0,    null,    @CRID,
        @OperID ,null,    @DocTime, '<Нет дисконтной карты>', @EmpID,
        @DocID, @CashSumCC,    @ChangeSumCC,    980,    0,
        0,    0,    0,    0,    0,
        0, 0, 0   ,    @DocCreateTime,    0,
        0)


    select ChID from t_Sale where DocID=@DocID