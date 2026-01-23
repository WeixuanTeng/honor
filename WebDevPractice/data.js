let data_array = [];
       // example {id:1592304983049, title: 'Deadpool', year: 2015}
       const addData = (ev)=>{
           ev.preventDefault();  //to stop the form submitting
           let  data = {
               id: Date.now(),
               liveyear: document.getElementById('liveyear').value,
               ownership: document.getElementById('ownership').value,
               describe: document.getElementById('describe').value,
               lon: document.getElementById('lon').value,
               lat: document.getElementById('lat').value,
           }
           data_array.push(data);
           document.forms[0].reset(); // to clear the form for the next entries
           //document.querySelector('form').reset();

           //for display purposes only
           console.warn('added' , {data_array} );
           let pre = document.querySelector('#msg pre');
           pre.textContent = '\n' + JSON.stringify(data_array, '\t', 2);

           //saving to localStorage
           //localStorage.setItem('MyMovieList', JSON.stringify(movies) );
       }
       document.addEventListener('DOMContentLoaded', ()=>{
           document.getElementById('btn').addEventListener('click', addData);
       });
