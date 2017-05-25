
-- declare @NewChID INT
-- select @NewChID =ISNULL(MAX(ChID),0)+1 from t_MonIntRec

declare @NewChID INT
exec dbo.z_NewChID 't_MonIntRec', @NewChID OUTPUT

-- declare @DocID INT
-- select @DocID =ISNULL(MAX(DocID),0)+1 from t_MonIntRec

declare  @CRID SMALLINT, @OurID INT

select  @CRID=c.CRID, @OurID = r.OurID
from r_Crs c
INNER JOIN r_CRSrvs r ON r.SrvID =c.SrvID
WHERE c.FacID=@FacID

declare @DocID INT
exec dbo.z_NewDocID 11051,'t_MonIntRec', @OurID, @DocID OUTPUT

declare @OperID INT

select @OperID=OperID from  r_OperCrs
WHERE CRID=@CRID AND CROperID = @CROperID

INSERT INTO t_MonIntRec (ChID,	OurID,	CRID,	DocDate,	SumCC,
                        Notes,	OperID,	DocTime,	CodeID1,	CodeID2,
                        CodeID3,	CodeID4,	CodeID5,	StateCode,	DocID,
                        IntDocID)

               VALUES  (@NewChID,@OurID,@CRID, @DocDate,@SumCC,
                        '',@OperID,@DocDate, 0,0,
                        0,0,0,0,@DocID,
                        @DocID)
