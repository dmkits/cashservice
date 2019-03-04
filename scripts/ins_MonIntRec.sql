declare @NewChID INT
exec dbo.z_NewChID 't_MonIntRec', @NewChID OUTPUT

declare @DocID INT
exec dbo.z_NewDocID 11051,'t_MonIntRec', @OurID, @DocID OUTPUT

declare  @CRID INT, @OurID INT
select  @CRID=c.CRID, @OurID = r.OurID
from r_Crs c, r_CRSrvs r WHERE r.SrvID =c.SrvID AND c.FacID=@FacID
declare @OperID INT
select @OperID=OperID from r_OperCrs WHERE CRID=@CRID AND CROperID = @CROperID

INSERT INTO t_MonIntRec (ChID,	OurID,	CRID,	DocDate,	SumCC,
                        Notes,	OperID,	DocTime,	CodeID1,	CodeID2,
                        CodeID3,	CodeID4,	CodeID5,	StateCode,	DocID,
                        IntDocID)
               VALUES  (@NewChID,@OurID,@CRID, @DocDate,@SumCC,
                        '',@OperID,@DocTime, 0,0,
                        0,0,0,0,@DocID,
                        @DocID)
