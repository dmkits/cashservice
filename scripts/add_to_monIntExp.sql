declare @NewChID INT
exec dbo.z_NewChID 't_MonIntExp', @NewChID OUTPUT


-- declare @DocID INT
-- select @DocID =ISNULL(MAX(DocID),0)+1 from t_MonIntExp



declare  @CRID INT, @OurID INT

select  @CRID=c.CRID, @OurID = r.OurID
from r_Crs c
INNER JOIN r_CRSrvs r ON r.SrvID =c.SrvID
WHERE c.FacID=@FacID

declare @DocID INT
exec dbo.z_NewDocID 11052,'t_MonIntExp', @OurID, @DocID OUTPUT

declare @OperID INT

select @OperID=OperID from  r_OperCrs
WHERE CRID=@CRID AND CROperID = @CROperID

INSERT INTO t_MonIntExp (ChID,	OurID,	CRID,	DocDate,	SumCC,
                        Notes,	OperID,	DocTime,	CodeID1,	CodeID2,
                        CodeID3,	CodeID4,	CodeID5,	StateCode,	DocID,
                        IntDocID)

               VALUES  (@NewChID,@OurID,@CRID, @DocDate,@SumCC,
                        '',@OperID,@DocTime, 0,0,
                        0,0,0,0,@DocID,
                        @DocID)
