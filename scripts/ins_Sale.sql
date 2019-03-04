declare @NewChID INT
-- select @NewChID =ISNULL(MAX(ChID),0)+1 from t_sale
exec dbo.z_NewChID 't_sale', @NewChID OUTPUT;

declare @StockID INT, @CRID INT, /*@OperID INT,*/ @EmpID INT, @OurID INT
select @StockID=c.StockID, @CRID=c.CRID, @OurID = r.OurID
from r_Crs c,r_CRSrvs r WHERE r.SrvID =c.SrvID AND c.FacID=@FacID;
-- select @OperID=OperID from  r_OperCrs WHERE CRID=@CRID AND CROperID = @CROperID
select @EmpID = EmpID from r_Opers where OperID=@OperID;

declare @NewDocID INT
--[dbo].[z_NewDocID](@DocCode int, @TableName varchar(250), @OurID int, @DocID int OUTPUT)
exec dbo.z_NewDocID 11035,'t_sale',@OurID, @NewDocID OUTPUT;

INSERT into t_sale
        (CHID,  DocID, DocDate, KursMC,  OurID,
        StockID,    CompID,    CodeID1,    CodeID2,    CodeID3,
        CodeID4, CodeID5,    Discount,    Notes,    CRID,
        OperID,    CreditID,    DocTime,    DCardID,    EmpID,
        IntDocID, CashSumCC,    ChangeSumCC,    CurrID,    TSumCC_nt,
        TTaxSum,    TSumCC_wt,    StateCode,    DeskCode,    Visitors,
        TPurSumCC_nt, TPurTaxSum,    TPurSumCC_wt,    DocCreateTime,    TRealSum,
        TLevySum)
VALUES  (@NewChID, @NewDocID, @DocDate, @KursMC, @OurID,
        @StockID, @CompID, @CodeID1, @CodeID2, @CodeID3,
        @CodeID4, @CodeID5, @Discount, @Notes,    @CRID,
        @OperID ,@CreditID, @DocTime, '<Нет дисконтной карты>', @EmpID,
        @DocID, @CashSumCC,    @ChangeSumCC,    @CurrID,    @TSumCC_nt,
        @TTaxSum,    @TSumCC_wt,    @StateCode,    @DeskCode,    @Visitors,
        @TPurSumCC_nt, @TPurTaxSum, @TPurSumCC_wt, @DocCreateTime, @TRealSum,
        @TLevySum);

select ChID=@NewChID;
