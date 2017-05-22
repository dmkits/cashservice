declare @NewChID INT
select @NewChID =ISNULL(MAX(ChID),0)+1 from t_zRep

declare @DocID INT
select @DocID =ISNULL(MAX(DocID),0)+1 from t_MonIntRec

declare  @CRID SMALLINT, @OurID INT

select  @CRID=c.CRID, @OurID = r.OurID
from r_Crs c
INNER JOIN r_CRSrvs r ON r.SrvID =c.SrvID
WHERE c.FacID=@FacID

INSERT INTO t_zRep  (ChID, DocDate,	DocTime,	CRID,	OperID,
                    OurID,	DocID,	FacID,	FinID,	ZRepNum,
                    SumCC_wt,	Sum_A,	Sum_B,	Sum_C,	Sum_D,	RetSum_A,	RetSum_B,
                    RetSum_C,	RetSum_D,	SumCash,	SumCard,	SumCredit,
                    SumCheque,	SumOther,	RetSumCash,	RetSumCard,	RetSumCredit,
                    RetSumCheque,	RetSumOther,	SumMonRec,	SumMonExp,	SumRem,
                    Notes,	Sum_E	Sum_F,	RetSum_E,	RetSum_F,	Tax_A	Tax_B,
                    Tax_C,	Tax_D,	Tax_E,	Tax_F,	RetTax_A,	RetTax_B,	RetTax_C,
                    RetTax_D,	RetTax_E,	RetTax_F)

          VALUES   (@NewChID, @DocDate,	@DocDate,	@CRID,	OperID,
                    @OurID,	@DocID,	@FacID,	@FinID,	@ZRepNum,
                    SumCC_wt,	Sum_A,	Sum_B,	Sum_C,	Sum_D,
                    RetSum_A,	RetSum_B, RetSum_C,	RetSum_D,	SumCash,
                    SumCard,	SumCredit, SumCheque,	SumOther,	RetSumCash,
                    RetSumCard,	RetSumCredit, RetSumCheque,	RetSumOther,	@SumMonRec,
                    @SumMonExp,	SumRem, '',	Sum_E	Sum_F,	RetSum_E,
                    RetSum_F,	Tax_A,	Tax_B, Tax_C,	Tax_D,
                    Tax_E,	Tax_F,	RetTax_A,	RetTax_B,	RetTax_C,
                    RetTax_D,	RetTax_E,	RetTax_F)




--
--
--           (@NewChID,@DocDate,@DocDate,@CRID,0/*нет OperID */,
--                   @OurID,@DocID,@FacID,@FinID,@ZRepNum,
--                   /*SumCC_wt*/,	/*Sum_A*/,	/*Sum_B*/,	/*Sum_C*/,	/*Sum_D*/,	0,	0,
--                     0,	0,	SumCash,	SumCard,	0,
--                     0,	0,	0,	0,	0,
--                     0,	0,	@SumMonRec,	@SumMonExp,	SumRem,
--                     '',	Sum_E,	Sum_F,	0,	0,	Tax_A,	Tax_B,
--                     Tax_C	Tax_D,	Tax_E	Tax_F,	RetTax_A,	RetTax_B,	RetTax_C,
--                     RetTax_D,	RetTax_E,	RetTax_F)
--
--                   )
