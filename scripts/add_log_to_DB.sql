-- declare @CRID SMALLINT


-- select  @CRID=c.CRID
-- from r_Crs c
-- WHERE c.FacID=@FacID;

insert into z_LogCashReg (CRID,DocTime,CashRegAction,Status, Msg,Notes)
    values(@CRID , GETDATE(),0, 0, @Msg,null )