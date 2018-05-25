
declare @SrcPosID INT
select @SrcPosID =ISNULL(MAX(SrcPosID),0)+1 from t_SalePays where ChID=@ChID


INSERT INTO t_SalePays
          (ChID,	SrcPosID,	PayFormCode,	SumCC_wt,	Notes,	POSPayID,	POSPayDocID,	POSPayRRN)
VALUES    (@ChID,	@SrcPosID,	@PayFormCode,	@SumCC_wt,	'',	0,	0,	'')
