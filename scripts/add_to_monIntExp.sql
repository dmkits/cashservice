declare @NewChID INT
select @NewChID =ISNULL(MAX(ChID),0)+1 from t_MonIntExp

declare @DocID INT
select @DocID =ISNULL(MAX(DocID),0)+1 from t_MonIntExp

declare  @CRID SMALLINT, @OurID INT

select  @CRID=c.CRID, @OurID = r.OurID
from r_Crs c
INNER JOIN r_CRSrvs r ON r.SrvID =c.SrvID
WHERE c.FacID=@FacID


INSERT INTO t_MonIntExp (ChID,	OurID,	CRID,	DocDate,	SumCC,
                        Notes,	OperID,	DocTime,	CodeID1,	CodeID2,
                        CodeID3,	CodeID4,	CodeID5,	StateCode,	DocID,
                        IntDocID)

               VALUES  (@NewChID,@OurID,@CRID, @DocDate,@SumCC,
                        '',@OperID,@DocDate, 0,0,
                        0,0,0,0,@DocID,
                        @DocID)
